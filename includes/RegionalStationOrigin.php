<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Default OpenRouteService route starts: main stations for Erlangen, Nürnberg, Fürth.
 */
final class RegionalStationOrigin
{
    /**
     * WGS84 coordinates (latitude, longitude) for regional main stations.
     *
     * @see https://openrouteservice.org
     */
    private const ERLANGEN_HBF_LAT = 49.59583;

    private const ERLANGEN_HBF_LON = 11.00472;

    private const NUERNBERG_HBF_LAT = 49.44543;

    private const NUERNBERG_HBF_LON = 11.08227;

    private const FUERTH_HBF_LAT = 49.46975;

    private const FUERTH_HBF_LON = 10.98889;

    /**
     * @return array{0: float, 1: float}|null Tuple longitude, latitude for OpenRouteService coordinates arrays.
     */
    public static function startLonLatForCity(string $city): ?array
    {
        $region = self::regionKeyForCityOrZip($city, '');

        return null !== $region ? self::lonLatForRegion($region) : null;
    }

    /**
     * Resolve route start: city name first, then common FAU-region postal prefixes if city is missing.
     *
     * @return array{0: float, 1: float}|null longitude, latitude
     */
    public static function startLonLatForCityOrZip(string $city, string $zip): ?array
    {
        $region = self::regionKeyForCityOrZip($city, $zip);

        return null !== $region ? self::lonLatForRegion($region) : null;
    }

    /**
     * Human-readable main station label for the resolved regional route start.
     */
    public static function labelForCityOrZip(string $city, string $zip): ?string
    {
        $region = self::regionKeyForCityOrZip($city, $zip);

        if (null === $region) {
            return null;
        }

        return match ($region) {
            'erlangen'  => __('Erlangen Hauptbahnhof', 'rrze-direction'),
            'nuernberg' => __('Nürnberg Hauptbahnhof', 'rrze-direction'),
            'fuerth'    => __('Fürth Hauptbahnhof', 'rrze-direction'),
            default     => null,
        };
    }

    /**
     * @return 'erlangen'|'nuernberg'|'fuerth'|null
     */
    private static function regionKeyForCityOrZip(string $city, string $zip): ?string
    {
        $normalized = self::normalizeCityToken($city);
        if ($normalized !== '') {
            if (str_contains($normalized, 'fuerth')) {
                return 'fuerth';
            }

            if (str_contains($normalized, 'nuernberg') || str_contains($normalized, 'nurnberg')) {
                return 'nuernberg';
            }

            if (str_contains($normalized, 'erlangen')) {
                return 'erlangen';
            }
        }

        $digits = preg_replace('/\D+/', '', $zip) ?? '';
        if (strlen($digits) < 3) {
            return null;
        }

        return match (substr($digits, 0, 3)) {
            '910'   => 'erlangen',
            '907'   => 'fuerth',
            '904'   => 'nuernberg',
            default => null,
        };
    }

    /**
     * @param 'erlangen'|'nuernberg'|'fuerth' $region
     *
     * @return array{0: float, 1: float}
     */
    private static function lonLatForRegion(string $region): array
    {
        return match ($region) {
            'fuerth'    => [self::FUERTH_HBF_LON, self::FUERTH_HBF_LAT],
            'nuernberg' => [self::NUERNBERG_HBF_LON, self::NUERNBERG_HBF_LAT],
            default     => [self::ERLANGEN_HBF_LON, self::ERLANGEN_HBF_LAT],
        };
    }

    private static function normalizeCityToken(string $city): string
    {
        $city = trim($city);
        if ($city === '') {
            return '';
        }

        $city = strtolower(remove_accents($city));

        return preg_replace('/\s+/', ' ', $city) ?? '';
    }
}
