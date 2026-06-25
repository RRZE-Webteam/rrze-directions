<?php

declare(strict_types=1);

namespace RRZE\Direction;

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
     * @return array{bike: string, car: string, transit: string}
     */
    public static function fetchDirectionHtml(
        string $apiKey,
        float $startLon,
        float $startLat,
        float $endLon,
        float $endLat,
        string $orsLanguage = 'en'
    ): array {
        if ($apiKey === '') {
            return ['bike' => '', 'car' => '', 'transit' => ''];
        }

        $orsLanguage = $orsLanguage === 'de' ? 'de' : 'en';
        $coords      = [$startLon, $startLat, $endLon, $endLat];

        return [
            'bike'    => self::fetchProfileHtml($apiKey, 'cycling-regular', $coords, $orsLanguage),
            'car'     => self::fetchProfileHtml($apiKey, 'driving-car', $coords, $orsLanguage),
            'transit' => self::fetchTransitPlaceholderHtml(
                self::fetchProfileHtml($apiKey, 'foot-walking', $coords, $orsLanguage),
                $orsLanguage
            ),
        ];
    }

    /**
     * @param array{0: float, 1: float, 2: float, 3: float} $coords lon, lat, lon, lat
     */
    private static function fetchProfileHtml(
        string $apiKey,
        string $profile,
        array $coords,
        string $orsLanguage
    ): string {
        $url = self::API_BASE . '/' . rawurlencode($profile) . '/json';

        $body = wp_json_encode([
            'coordinates'  => [
                [$coords[0], $coords[1]],
                [$coords[2], $coords[3]],
            ],
            // Required for turn-by-turn `steps` with `instruction` text (see ORS directions docs).
            'instructions' => true,
            'geometry'     => true,
            'language'     => $orsLanguage,
        ]);

        if (!is_string($body)) {
            return '';
        }

        $response = wp_remote_post(
            $url,
            [
                'timeout' => 20,
                'headers' => [
                    'Authorization' => $apiKey,
                    'Content-Type'  => 'application/json; charset=utf-8',
                    'Accept'        => 'application/json',
                ],
                'body'    => $body,
            ]
        );

        if (is_wp_error($response)) {
            return '';
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        if ($code < 200 || $code >= 300) {
            return '';
        }

        $raw = wp_remote_retrieve_body($response);
        if (!is_string($raw) || $raw === '') {
            return '';
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded)
            ? self::directionsPayloadToHtml($decoded, $orsLanguage)
            : '';
    }

    /**
     * @param array<string, mixed> $decoded JSON `routes` response or GeoJSON FeatureCollection (legacy).
     */
    private static function directionsPayloadToHtml(array $decoded, string $orsLanguage): string
    {
        $summary  = [];
        $segments = [];

        if (isset($decoded['routes'][0]) && is_array($decoded['routes'][0])) {
            $route    = $decoded['routes'][0];
            $summary  = is_array($route['summary'] ?? null) ? $route['summary'] : [];
            $segments = is_array($route['segments'] ?? null) ? $route['segments'] : [];
        } elseif (($decoded['type'] ?? '') === 'FeatureCollection') {
            $features = $decoded['features'] ?? [];
            if (!is_array($features) || $features === []) {
                return '';
            }

            $first = $features[0];
            if (!is_array($first)) {
                return '';
            }

            $props    = $first['properties'] ?? [];
            $summary  = is_array($props['summary'] ?? null) ? $props['summary'] : [];
            $segments = is_array($props['segments'] ?? null) ? $props['segments'] : [];
        } else {
            return '';
        }

        return self::summaryAndSegmentsToHtml($summary, $segments, $orsLanguage);
    }

    /**
     * @param array<string, mixed>        $summary
     * @param array<int, array<mixed>> $segments
     */
    private static function summaryAndSegmentsToHtml(
        array $summary,
        array $segments,
        string $orsLanguage
    ): string {
        $distanceM = isset($summary['distance']) && is_numeric($summary['distance'])
            ? (float) $summary['distance']
            : null;
        $durationS = isset($summary['duration']) && is_numeric($summary['duration'])
            ? (float) $summary['duration']
            : null;

        $steps = [];
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
                if ($instr !== '') {
                    $steps[] = $instr;
                }
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
                    __('Etwa %1$s km, %2$s Min.', 'rrze-direction'),
                    (string) $km,
                    (string) $min
                );
            } else {
                $summaryLine = sprintf(
                    /* translators: 1: distance in km, 2: duration in minutes */
                    __('About %1$s km, %2$s min', 'rrze-direction'),
                    (string) $km,
                    (string) $min
                );
            }
            $parts[] = '<p><strong>' . esc_html($summaryLine) . '</strong></p>';
        }

        $lis = [];
        foreach ($steps as $text) {
            $lis[] = '<li>' . esc_html($text) . '</li>';
        }
        $parts[] = '<ol class="rrze-direction-ors-steps">' . implode('', $lis) . '</ol>';

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
                'rrze-direction'
            );
        } else {
            $introText = __(
                'Walking route from the main station (approximation — use local timetables for buses and trains).',
                'rrze-direction'
            );
        }

        $intro = '<p><em>' . esc_html($introText) . '</em></p>';

        return $intro . $walkingHtml;
    }
}
