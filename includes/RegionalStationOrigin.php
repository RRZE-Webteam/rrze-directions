<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Fixed OpenRouteService route starts: Erlangen Hbf, Nürnberg Hbf, Nürnberg Flughafen.
 */
final class RegionalStationOrigin
{
    private const ERLANGEN_HBF_LAT = 49.59583;

    private const ERLANGEN_HBF_LON = 11.00472;

    private const NUERNBERG_HBF_LAT = 49.44543;

    private const NUERNBERG_HBF_LON = 11.08227;

    /** Albrecht Dürer Airport Nürnberg (NUE). */
    private const NUERNBERG_AIRPORT_LAT = 49.4987;

    private const NUERNBERG_AIRPORT_LON = 11.0781;

    /**
     * All regional route starts (always used for direction drafts).
     *
     * @return list<array{key: string, label: string, lon: float, lat: float}>
     */
    public static function allStartPoints(): array
    {
        return [
            [
                'key'   => 'erlangen',
                'label' => __('Erlangen Hauptbahnhof', 'rrze-direction'),
                'lon'   => self::ERLANGEN_HBF_LON,
                'lat'   => self::ERLANGEN_HBF_LAT,
            ],
            [
                'key'   => 'nuernberg',
                'label' => __('Nürnberg Hauptbahnhof', 'rrze-direction'),
                'lon'   => self::NUERNBERG_HBF_LON,
                'lat'   => self::NUERNBERG_HBF_LAT,
            ],
            [
                'key'   => 'nuernberg_airport',
                'label' => __('Nürnberg Flughafen', 'rrze-direction'),
                'lon'   => self::NUERNBERG_AIRPORT_LON,
                'lat'   => self::NUERNBERG_AIRPORT_LAT,
            ],
        ];
    }

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
     * Human-readable route start label for the resolved region.
     */
    public static function labelForCityOrZip(string $city, string $zip): ?string
    {
        $region = self::regionKeyForCityOrZip($city, $zip);

        if (null === $region) {
            return null;
        }

        return match ($region) {
            'erlangen'          => __('Erlangen Hauptbahnhof', 'rrze-direction'),
            'nuernberg'         => __('Nürnberg Hauptbahnhof', 'rrze-direction'),
            'nuernberg_airport' => __('Nürnberg Flughafen', 'rrze-direction'),
            default             => null,
        };
    }

    /**
     * @return 'erlangen'|'nuernberg'|'nuernberg_airport'|null
     */
    private static function regionKeyForCityOrZip(string $city, string $zip): ?string
    {
        $normalized = self::normalizeCityToken($city);
        if ($normalized !== '') {
            if (str_contains($normalized, 'flughafen') || str_contains($normalized, 'airport')) {
                return 'nuernberg_airport';
            }

            if (str_contains($normalized, 'fuerth')) {
                return 'nuernberg_airport';
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
            '907'   => 'nuernberg_airport',
            '904'   => 'nuernberg',
            default => null,
        };
    }

    /**
     * @param 'erlangen'|'nuernberg'|'nuernberg_airport' $region
     *
     * @return array{0: float, 1: float}
     */
    private static function lonLatForRegion(string $region): array
    {
        return match ($region) {
            'nuernberg'         => [self::NUERNBERG_HBF_LON, self::NUERNBERG_HBF_LAT],
            'nuernberg_airport' => [self::NUERNBERG_AIRPORT_LON, self::NUERNBERG_AIRPORT_LAT],
            default             => [self::ERLANGEN_HBF_LON, self::ERLANGEN_HBF_LAT],
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
