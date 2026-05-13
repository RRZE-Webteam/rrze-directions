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
        $normalized = self::normalizeCityToken($city);
        if ($normalized === '') {
            return null;
        }

        if (str_contains($normalized, 'fuerth')) {
            return [self::FUERTH_HBF_LON, self::FUERTH_HBF_LAT];
        }

        if (str_contains($normalized, 'nuernberg') || str_contains($normalized, 'nurnberg')) {
            return [self::NUERNBERG_HBF_LON, self::NUERNBERG_HBF_LAT];
        }

        if (str_contains($normalized, 'erlangen')) {
            return [self::ERLANGEN_HBF_LON, self::ERLANGEN_HBF_LAT];
        }

        return null;
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
