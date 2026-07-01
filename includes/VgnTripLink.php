<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Builds VGN universal trip planner links for regional station starts.
 *
 * @see https://www.vgn.de/universallink/trip/
 */
final class VgnTripLink
{
    private const BASE_URL = 'https://www.vgn.de/universallink/trip/';

    /** @var list<string> */
    private const STATION_KEYS = ['erlangen', 'nuernberg'];

    public static function isStationStart(string $startKey): bool
    {
        return in_array($startKey, self::STATION_KEYS, true);
    }

    /**
     * @param array<string, mixed> $attributes Block attributes (destination coordinates and labels).
     */
    public static function buildTripUrl(string $startKey, array $attributes): ?string
    {
        if (!self::isStationStart($startKey)) {
            return null;
        }

        $origin = self::stationByKey($startKey);
        if ($origin === null) {
            return null;
        }

        [$destLat, $destLon] = MapLinks::coordinatesFromAttributes($attributes);
        if ($destLat === null || $destLon === null) {
            return null;
        }

        $originNames = self::splitLabel($origin['label']);
        $destNames   = self::destinationNames($attributes);

        if ($destNames['name'] === '') {
            return null;
        }

        $params = [
            'origin_lat'       => self::formatCoordinate($origin['lat']),
            'origin_lng'       => self::formatCoordinate($origin['lon']),
            'origin_name'      => $originNames['name'],
            'destination_lat'  => self::formatCoordinate($destLat),
            'destination_lng'  => self::formatCoordinate($destLon),
            'destination_name' => $destNames['name'],
            'time'             => self::departureTime(),
        ];

        if ($originNames['name2'] !== '') {
            $params['origin_name2'] = $originNames['name2'];
        }

        if ($destNames['name2'] !== '') {
            $params['destination_name2'] = $destNames['name2'];
        }

        return self::BASE_URL . '?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * @param array<string, mixed> $attributes
     *
     * @return array{name: string, name2: string}
     */
    public static function destinationNames(array $attributes): array
    {
        $city   = trim((string) ($attributes['addressCity'] ?? ''));
        $org    = trim((string) ($attributes['organizationName'] ?? ''));
        $street = trim((string) ($attributes['addressStreet'] ?? ''));
        $room   = trim((string) ($attributes['addressRoom'] ?? ''));

        $name = $city !== '' ? $city : $org;

        $secondary = [];
        if ($org !== '' && $org !== $name) {
            $secondary[] = $org;
        }
        if ($street !== '') {
            $secondary[] = $street;
        }
        if ($room !== '') {
            $secondary[] = $room;
        }

        return [
            'name'  => $name,
            'name2' => implode(', ', $secondary),
        ];
    }

    /**
     * @return array{name: string, name2: string}
     */
    public static function splitLabel(string $label): array
    {
        $label = trim($label);
        if ($label === '') {
            return ['name' => '', 'name2' => ''];
        }

        $pos = strpos($label, ' ');
        if ($pos === false) {
            return ['name' => $label, 'name2' => ''];
        }

        return [
            'name'  => substr($label, 0, $pos),
            'name2' => trim(substr($label, $pos + 1)),
        ];
    }

    /**
     * @return array{key: string, label: string, lon: float, lat: float}|null
     */
    private static function stationByKey(string $startKey): ?array
    {
        foreach (RegionalStationOrigin::allStartPoints() as $start) {
            if ($start['key'] === $startKey) {
                return $start;
            }
        }

        return null;
    }

    private static function formatCoordinate(float $value): string
    {
        $formatted = rtrim(rtrim(sprintf('%.5f', $value), '0'), '.');

        return $formatted === '' ? '0' : $formatted;
    }

    private static function departureTime(): string
    {
        $timezone = wp_timezone();

        return (new \DateTimeImmutable('now', $timezone))->format('Y-m-d\TH:i:sO');
    }
}
