<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * External map links for resolved coordinates.
 */
final class MapLinks
{
    /**
     * @param array<string,mixed> $attributes
     *
     * @return array{0: ?float, 1: ?float}
     */
    public static function coordinatesFromAttributes(array $attributes): array
    {
        $lat = self::parseCoordinate($attributes['mapLatitude'] ?? null);
        $lon = self::parseCoordinate($attributes['mapLongitude'] ?? null);

        return [$lat, $lon];
    }

    /**
     * @param float|int|string|null $value
     */
    public static function parseCoordinate(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $s = str_replace(',', '.', trim((string) $value));
        if ($s === '' || !is_numeric($s)) {
            return null;
        }

        $f = (float) $s;

        return is_finite($f) ? $f : null;
    }

    public static function googleMapsUrl(float $latitude, float $longitude): string
    {
        $query = rawurlencode($latitude . ',' . $longitude);

        return 'https://www.google.com/maps/dir/?api=1&destination=' . $query;
    }

    public static function appleMapsUrl(float $latitude, float $longitude): string
    {
        $pair = $latitude . ',' . $longitude;

        return 'https://maps.apple.com/?daddr=' . rawurlencode($pair) . '&q=' . rawurlencode($pair);
    }

    public static function formatCoordinatePair(float $latitude, float $longitude): string
    {
        return self::formatCoordinateValue($latitude) . ', ' . self::formatCoordinateValue($longitude);
    }

    private static function formatCoordinateValue(float $value): string
    {
        $formatted = rtrim(rtrim(sprintf('%.8f', $value), '0'), '.');

        return $formatted === '' ? '0' : $formatted;
    }
}
