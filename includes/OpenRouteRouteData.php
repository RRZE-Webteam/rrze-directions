<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Structured route geometry and step coordinates from OpenRouteService responses.
 */
final class OpenRouteRouteData
{
    /**
     * Compact JSON for block attributes and the Leaflet route map script.
     */
    public static function toJson(
        array $decoded,
        ?float $destinationLat = null,
        ?float $destinationLon = null,
        string $destinationLabel = ''
    ): string {
        $route = self::fromDecoded($decoded);
        if ($route === null) {
            return '';
        }

        if (null !== $destinationLat && null !== $destinationLon) {
            $route['destination'] = [
                'lat'   => $destinationLat,
                'lon'   => $destinationLon,
                'label' => trim($destinationLabel),
            ];
        }

        $json = wp_json_encode($route);

        return is_string($json) ? $json : '';
    }

    /**
     * @return array{
     *   coordinates: list<array{lat: float, lon: float}>,
     *   steps: list<array{n: int, lat: float, lon: float, instruction: string}>,
     *   bounds: array{south: float, north: float, west: float, east: float}
     * }|null
     */
    public static function fromDecoded(array $decoded): ?array
    {
        $route = self::extractRoute($decoded);
        if ($route === null) {
            return null;
        }

        $geometryPoints = self::geometryPointsFromRoute($route);
        if (count($geometryPoints) < 2) {
            return null;
        }

        $segments = is_array($route['segments'] ?? null) ? $route['segments'] : [];
        $steps    = self::stepsFromSegments($segments, $geometryPoints);

        if ($steps === []) {
            return null;
        }

        $bounds = self::boundsFromPoints($geometryPoints);

        return [
            'coordinates' => self::simplifyPoints($geometryPoints),
            'steps'       => $steps,
            'bounds'      => $bounds,
        ];
    }

    /**
     * Keep block attributes small enough for reliable editor saves.
     *
     * @param list<array{lat: float, lon: float}> $points
     *
     * @return list<array{lat: float, lon: float}>
     */
    private static function simplifyPoints(array $points, int $maxPoints = 320): array
    {
        $count = count($points);
        if ($count <= $maxPoints) {
            return $points;
        }

        $simplified = [];
        $lastIndex  = $count - 1;

        for ($i = 0; $i < $maxPoints; ++$i) {
            $index = (int) round(($i / ($maxPoints - 1)) * $lastIndex);
            $simplified[] = $points[$index];
        }

        return $simplified;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function extractRoute(array $decoded): ?array
    {
        if (isset($decoded['routes'][0]) && is_array($decoded['routes'][0])) {
            return $decoded['routes'][0];
        }

        if (($decoded['type'] ?? '') === 'FeatureCollection') {
            $features = $decoded['features'] ?? [];
            if (!is_array($features) || !isset($features[0]) || !is_array($features[0])) {
                return null;
            }

            $feature = $features[0];
            $props   = is_array($feature['properties'] ?? null) ? $feature['properties'] : [];

            if (isset($feature['geometry']) && is_array($feature['geometry'])) {
                $props['geometry'] = $feature['geometry'];
            }

            return $props;
        }

        return null;
    }

    /**
     * @return list<array{lat: float, lon: float}>
     */
    public static function geometryPointsFromRoute(array $route): array
    {
        $geometry = $route['geometry'] ?? null;

        if (is_string($geometry) && $geometry !== '') {
            return self::decodeEncodedPolyline($geometry);
        }

        if (!is_array($geometry)) {
            return [];
        }

        if (($geometry['type'] ?? '') === 'LineString') {
            return self::pointsFromCoordinatePairs($geometry['coordinates'] ?? []);
        }

        return [];
    }

    /**
     * @param array<int, mixed> $pairs
     *
     * @return list<array{lat: float, lon: float}>
     */
    private static function pointsFromCoordinatePairs(array $pairs): array
    {
        $points = [];

        foreach ($pairs as $pair) {
            if (!is_array($pair) || count($pair) < 2) {
                continue;
            }

            $lon = (float) $pair[0];
            $lat = (float) $pair[1];
            $points[] = ['lat' => $lat, 'lon' => $lon];
        }

        return $points;
    }

    /**
     * @return list<array{lat: float, lon: float}>
     */
    private static function decodeEncodedPolyline(string $encoded): array
    {
        $points  = [];
        $index   = 0;
        $length  = strlen($encoded);
        $lat     = 0;
        $lon     = 0;

        while ($index < $length) {
            $result = 0;
            $shift  = 0;

            do {
                if ($index >= $length) {
                    break 2;
                }
                $b       = ord($encoded[$index++]) - 63;
                $result |= ($b & 0x1f) << $shift;
                $shift  += 5;
            } while ($b >= 0x20);

            $deltaLat = ($result & 1) !== 0 ? ~(int) ($result >> 1) : (int) ($result >> 1);
            $lat     += $deltaLat;

            $result = 0;
            $shift  = 0;

            do {
                if ($index >= $length) {
                    break 2;
                }
                $b       = ord($encoded[$index++]) - 63;
                $result |= ($b & 0x1f) << $shift;
                $shift  += 5;
            } while ($b >= 0x20);

            $deltaLon = ($result & 1) !== 0 ? ~(int) ($result >> 1) : (int) ($result >> 1);
            $lon     += $deltaLon;

            $points[] = [
                'lat' => $lat / 1e5,
                'lon' => $lon / 1e5,
            ];
        }

        return $points;
    }

    /**
     * @param array<int, array<mixed>>           $segments
     * @param list<array{lat: float, lon: float}> $geometryPoints
     *
     * @return list<array{n: int, lat: float, lon: float, instruction: string}>
     */
    private static function stepsFromSegments(array $segments, array $geometryPoints): array
    {
        $steps = [];
        $n     = 0;

        foreach ($segments as $segment) {
            if (!is_array($segment)) {
                continue;
            }

            foreach ($segment['steps'] ?? [] as $step) {
                if (!is_array($step)) {
                    continue;
                }

                $instr = isset($step['instruction']) ? trim((string) $step['instruction']) : '';
                if ($instr === '' && isset($step['name'])) {
                    $instr = trim((string) $step['name']);
                }

                if ($instr === '') {
                    continue;
                }

                $point = self::stepStartPoint($geometryPoints, $step);
                if (null === $point) {
                    continue;
                }

                ++$n;
                $steps[] = [
                    'n'           => $n,
                    'lat'         => $point['lat'],
                    'lon'         => $point['lon'],
                    'instruction' => $instr,
                ];
            }
        }

        return $steps;
    }

    /**
     * @param list<array{lat: float, lon: float}> $geometryPoints
     * @param array<string, mixed>                $step
     *
     * @return array{lat: float, lon: float}|null
     */
    public static function stepStartPoint(array $geometryPoints, array $step): ?array
    {
        $wayPoints = $step['way_points'] ?? null;
        if (!is_array($wayPoints) || !isset($wayPoints[0])) {
            return null;
        }

        $index = (int) $wayPoints[0];

        return $geometryPoints[$index] ?? null;
    }

    /**
     * @param list<array{lat: float, lon: float}> $points
     *
     * @return array{south: float, north: float, west: float, east: float}
     */
    private static function boundsFromPoints(array $points): array
    {
        $south = $points[0]['lat'];
        $north = $points[0]['lat'];
        $west  = $points[0]['lon'];
        $east  = $points[0]['lon'];

        foreach ($points as $point) {
            $south = min($south, $point['lat']);
            $north = max($north, $point['lat']);
            $west  = min($west, $point['lon']);
            $east  = max($east, $point['lon']);
        }

        return [
            'south' => $south,
            'north' => $north,
            'west'  => $west,
            'east'  => $east,
        ];
    }
}
