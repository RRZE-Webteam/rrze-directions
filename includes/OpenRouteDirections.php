<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Fetches route instructions from the OpenRouteService directions API.
 *
 * @link https://openrouteservice.org/dev/#/api-docs/introduction
 */
final class OpenRouteDirections
{
    private const API_BASE = 'https://api.openrouteservice.org/v2/directions';

    /**
     * Site language from Settings > General (not necessarily the current admin user locale).
     */
    public static function siteLocaleForDirections(): string
    {
        $locale = get_option('locale', '');
        if (is_string($locale) && $locale !== '') {
            return $locale;
        }

        $wplang = get_option('WPLANG', '');
        if (is_string($wplang) && $wplang !== '') {
            return $wplang;
        }

        return get_locale();
    }

    /**
     * OpenRouteService `language` code: German for German locales, English otherwise.
     *
     * @see https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/requests-and-return-types
     */
    public static function orsLanguageFromWpLocale(string $locale): string
    {
        $locale = strtolower(trim($locale));

        if ($locale !== '' && str_starts_with($locale, 'de')) {
            return 'de';
        }

        return 'en';
    }

    /**
     * @return array{
     *   bike: array{html: string, route: string},
     *   car: array{html: string, route: string},
     *   transit: array{html: string, route: string}
     * }
     */
    public static function fetchDirections(
        string $apiKey,
        float $startLon,
        float $startLat,
        float $endLon,
        float $endLat,
        string $orsLanguage = 'en',
        string $fromLabel = '',
        string $toLabel = ''
    ): array {
        $empty = static fn(): array => ['html' => '', 'route' => ''];

        if ($apiKey === '') {
            return ['bike' => $empty(), 'car' => $empty(), 'transit' => $empty()];
        }

        $orsLanguage = $orsLanguage === 'de' ? 'de' : 'en';
        $coords      = [$startLon, $startLat, $endLon, $endLat];
        $routeTitle  = self::routeTitleHtml($fromLabel, $toLabel, $orsLanguage);

        $profiles = self::fetchProfilesDecoded($apiKey, $coords, $orsLanguage);
        $bikeDecoded    = $profiles['bike'];
        $carDecoded     = $profiles['car'];
        $walkingDecoded = $profiles['walking'];

        $bikeHtml = $bikeDecoded
            ? self::directionsPayloadToHtml($bikeDecoded, $orsLanguage)
            : '';
        $carHtml = $carDecoded
            ? self::directionsPayloadToHtml($carDecoded, $orsLanguage)
            : '';
        $walkingHtml = $walkingDecoded
            ? self::directionsPayloadToHtml($walkingDecoded, $orsLanguage)
            : '';

        return [
            'bike' => [
                'html'  => self::withRouteTitle($bikeHtml, $routeTitle),
                'route' => $bikeDecoded
                    ? OpenRouteRouteData::toJson($bikeDecoded, $endLat, $endLon, $toLabel)
                    : '',
            ],
            'car' => [
                'html'  => self::withRouteTitle($carHtml, $routeTitle),
                'route' => $carDecoded
                    ? OpenRouteRouteData::toJson($carDecoded, $endLat, $endLon, $toLabel)
                    : '',
            ],
            'transit' => [
                'html'  => self::withRouteTitle(
                    self::fetchTransitPlaceholderHtml($walkingHtml, $orsLanguage),
                    $routeTitle
                ),
                'route' => $walkingDecoded
                    ? OpenRouteRouteData::toJson($walkingDecoded, $endLat, $endLon, $toLabel)
                    : '',
            ],
        ];
    }

    /**
     * Fetch bike, car, and transit directions from every regional start point.
     *
     * @return array{
     *   bike: array{html: string, route: string},
     *   car: array{html: string, route: string},
     *   transit: array{html: string, route: string}
     * }
     */
    public static function fetchDirectionsFromAllStarts(
        string $apiKey,
        float $endLon,
        float $endLat,
        string $orsLanguage = 'en',
        string $toLabel = ''
    ): array {
        $emptyMode = static fn(): array => ['html' => '', 'route' => ''];
        $combined  = [
            'bike'    => $emptyMode(),
            'car'     => $emptyMode(),
            'transit' => $emptyMode(),
        ];

        if ($apiKey === '') {
            return $combined;
        }

        $routeVariants = [
            'bike'    => [],
            'car'     => [],
            'transit' => [],
        ];

        foreach (RegionalStationOrigin::allStartPoints() as $start) {
            $dirs = self::fetchDirections(
                $apiKey,
                $start['lon'],
                $start['lat'],
                $endLon,
                $endLat,
                $orsLanguage,
                $start['label'],
                $toLabel
            );

            foreach (['bike', 'car', 'transit'] as $mode) {
                if ($dirs[$mode]['html'] === '' && $dirs[$mode]['route'] === '') {
                    continue;
                }

                if ($dirs[$mode]['html'] !== '') {
                    $combined[$mode]['html'] .= '<div class="rrze-directions__route-variant">';
                    $combined[$mode]['html'] .= $dirs[$mode]['html'];
                    $combined[$mode]['html'] .= '</div>';
                }

                if ($dirs[$mode]['route'] === '') {
                    continue;
                }

                $routeDecoded = json_decode($dirs[$mode]['route'], true);
                if (!is_array($routeDecoded)) {
                    continue;
                }

                $routeVariants[$mode][] = [
                    'startKey'   => $start['key'],
                    'startLabel' => $start['label'],
                    'route'      => $routeDecoded,
                ];
            }
        }

        foreach (['bike', 'car', 'transit'] as $mode) {
            $combined[$mode]['route'] = RouteMapPresentation::encodeVariantsJson($routeVariants[$mode]);
        }

        return $combined;
    }

    private static function withRouteTitle(string $html, string $routeTitle): string
    {
        if ($html === '' || $routeTitle === '') {
            return $html;
        }

        return $routeTitle . $html;
    }

    private static function routeTitleHtml(string $fromLabel, string $toLabel, string $orsLanguage): string
    {
        $fromLabel = trim($fromLabel);
        $toLabel   = trim($toLabel);

        if ($fromLabel === '' || $toLabel === '') {
            return '';
        }

        if ($orsLanguage === 'de') {
            $title = sprintf(
                /* translators: 1: route start, 2: destination */
                __('Von %1$s nach %2$s', 'rrze-directions'),
                $fromLabel,
                $toLabel
            );
        } else {
            $title = sprintf(
                /* translators: 1: route start, 2: destination */
                __('From %1$s to %2$s', 'rrze-directions'),
                $fromLabel,
                $toLabel
            );
        }

        return '<p class="rrze-directions-route-title"><strong>'
            . esc_html($title)
            . '</strong></p>';
    }

    /**
     * @param array{0: float, 1: float, 2: float, 3: float} $coords lon, lat, lon, lat
     *
     * @return array{bike: ?array<string, mixed>, car: ?array<string, mixed>, walking: ?array<string, mixed>}
     */
    private static function fetchProfilesDecoded(
        string $apiKey,
        array $coords,
        string $orsLanguage
    ): array {
        return ApiCache::remember(
            'openroute',
            ApiCache::hashKey($coords, $orsLanguage),
            static fn (): array => self::requestProfilesDecoded($apiKey, $coords, $orsLanguage),
            static function (array $decoded): bool {
                return null === ($decoded['bike'] ?? null)
                    && null === ($decoded['car'] ?? null)
                    && null === ($decoded['walking'] ?? null);
            }
        );
    }

    /**
     * @param array{0: float, 1: float, 2: float, 3: float} $coords lon, lat, lon, lat
     *
     * @return array{bike: ?array<string, mixed>, car: ?array<string, mixed>, walking: ?array<string, mixed>}
     */
    private static function requestProfilesDecoded(
        string $apiKey,
        array $coords,
        string $orsLanguage
    ): array {
        $empty = ['bike' => null, 'car' => null, 'walking' => null];

        $body = wp_json_encode([
            'coordinates'  => [
                [$coords[0], $coords[1]],
                [$coords[2], $coords[3]],
            ],
            'instructions' => true,
            'geometry'     => true,
            'language'     => $orsLanguage,
        ]);

        if (!is_string($body)) {
            return $empty;
        }

        $headers = [
            'Authorization' => $apiKey,
            'Content-Type'  => 'application/json; charset=utf-8',
            'Accept'        => 'application/json',
        ];

        $profiles = [
            'bike'    => 'cycling-regular',
            'car'     => 'driving-car',
            'walking' => 'foot-walking',
        ];

        $requests = [];
        foreach ($profiles as $key => $profile) {
            $requests[$key] = [
                'url'     => self::API_BASE . '/' . rawurlencode($profile) . '/json',
                'type'    => 'POST',
                'headers' => $headers,
                'data'    => $body,
                'options' => [
                    'timeout' => 15,
                ],
            ];
        }

        if (class_exists(\WpOrg\Requests\Requests::class)) {
            $responses = \WpOrg\Requests\Requests::request_multiple($requests);
            $decoded   = [];

            foreach ($profiles as $key => $profile) {
                $decoded[$key] = self::decodeOrsHttpResponse($responses[$key] ?? null);
            }

            return $decoded;
        }

        $decoded = [];
        foreach ($profiles as $key => $profile) {
            $decoded[$key] = self::fetchProfileDecoded($apiKey, $profile, $coords, $orsLanguage);
        }

        return $decoded;
    }

    /**
     * @param mixed $response Response or exception from Requests::request_multiple().
     *
     * @return array<string, mixed>|null
     */
    private static function decodeOrsHttpResponse(mixed $response): ?array
    {
        if ($response instanceof \WpOrg\Requests\Exception) {
            return null;
        }

        if (!$response instanceof \WpOrg\Requests\Response) {
            return null;
        }

        if ($response->status_code < 200 || $response->status_code >= 300) {
            return null;
        }

        $raw = $response->body;
        if (!is_string($raw) || $raw === '') {
            return null;
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param array{0: float, 1: float, 2: float, 3: float} $coords lon, lat, lon, lat
     *
     * @return array<string, mixed>|null
     */
    private static function fetchProfileDecoded(
        string $apiKey,
        string $profile,
        array $coords,
        string $orsLanguage
    ): ?array {
        $url = self::API_BASE . '/' . rawurlencode($profile) . '/json';

        $body = wp_json_encode([
            'coordinates'  => [
                [$coords[0], $coords[1]],
                [$coords[2], $coords[3]],
            ],
            'instructions' => true,
            'geometry'     => true,
            'language'     => $orsLanguage,
        ]);

        if (!is_string($body)) {
            return null;
        }

        $response = wp_remote_post(
            $url,
            [
                'timeout' => 15,
                'headers' => [
                    'Authorization' => $apiKey,
                    'Content-Type'  => 'application/json; charset=utf-8',
                    'Accept'        => 'application/json',
                ],
                'body'    => $body,
            ]
        );

        if (is_wp_error($response)) {
            return null;
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        if ($code < 200 || $code >= 300) {
            return null;
        }

        $raw = wp_remote_retrieve_body($response);
        if (!is_string($raw) || $raw === '') {
            return null;
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param array<string, mixed> $decoded JSON `routes` response or GeoJSON FeatureCollection (legacy).
     */
    private static function directionsPayloadToHtml(array $decoded, string $orsLanguage): string
    {
        $route = self::extractRoute($decoded);
        if (null === $route) {
            return '';
        }

        $summary        = is_array($route['summary'] ?? null) ? $route['summary'] : [];
        $segments       = is_array($route['segments'] ?? null) ? $route['segments'] : [];
        $geometryPoints = OpenRouteRouteData::geometryPointsFromRoute($route);

        return self::summaryAndSegmentsToHtml(
            $summary,
            $segments,
            $orsLanguage,
            $geometryPoints
        );
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
     * @param array<string, mixed>                  $summary
     * @param array<int, array<mixed>>              $segments
     * @param list<array{lat: float, lon: float}>  $geometryPoints
     */
    private static function summaryAndSegmentsToHtml(
        array $summary,
        array $segments,
        string $orsLanguage,
        array $geometryPoints
    ): string {
        $distanceM = isset($summary['distance']) && is_numeric($summary['distance'])
            ? (float) $summary['distance']
            : null;
        $durationS = isset($summary['duration']) && is_numeric($summary['duration'])
            ? (float) $summary['duration']
            : null;

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

                ++$n;
                $point   = OpenRouteRouteData::stepStartPoint($geometryPoints, $step);
                $steps[] = [
                    'n'           => $n,
                    'instruction' => $instr,
                    'lat'         => $point['lat'] ?? null,
                    'lon'         => $point['lon'] ?? null,
                ];
            }
        }

        if ($steps === []) {
            return '';
        }

        $parts = [];

        if (null !== $distanceM && null !== $durationS && $distanceM > 0 && $durationS >= 0) {
            $km  = round($distanceM / 1000, 1);
            $min = max(1, (int) round($durationS / 60));
            if ($orsLanguage === 'de') {
                $summaryLine = sprintf(
                    /* translators: 1: distance in km, 2: duration in minutes */
                    __('Etwa %1$s km, %2$s Min.', 'rrze-directions'),
                    (string) $km,
                    (string) $min
                );
            } else {
                $summaryLine = sprintf(
                    /* translators: 1: distance in km, 2: duration in minutes */
                    __('About %1$s km, %2$s min', 'rrze-directions'),
                    (string) $km,
                    (string) $min
                );
            }
            $parts[] = '<p><strong>' . esc_html($summaryLine) . '</strong></p>';
        }

        $lis = [];
        foreach ($steps as $step) {
            $lis[] = '<li class="rrze-directions-ors-step">'
                . esc_html($step['instruction'])
                . '</li>';
        }

        $parts[] = '<ol class="rrze-directions-ors-steps">' . implode('', $lis) . '</ol>';

        return implode('', $parts);
    }

    private static function fetchTransitPlaceholderHtml(string $walkingHtml, string $orsLanguage): string
    {
        if ($walkingHtml === '') {
            return '';
        }

        if ($orsLanguage === 'de') {
            $introText = __(
                'Fußweg ab Hauptbahnhof (Näherung — für Bus und Bahn bitte aktuelle Fahrpläne nutzen).',
                'rrze-directions'
            );
        } else {
            $introText = __(
                'Walking route from the main station (approximation — use local timetables for buses and trains).',
                'rrze-directions'
            );
        }

        $intro = '<p><em>' . esc_html($introText) . '</em></p>';

        return $intro . $walkingHtml;
    }
}
