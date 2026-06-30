<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Resolves map coordinates from the FAU map service GeoJSON API.
 *
 * @link https://karte.fau.de/api/doc
 */
final class FauMapGeojson
{
    private const HOST_SUFFIX = 'karte.fau.de';

    private const API_GEOJSON_PATH = '/api/v1/geojson';

    /**
     * Resolve latitude/longitude for a workplace using karte.fau.de when FAUdir has none.
     *
     * @return array{0: ?float, 1: ?float}
     */
    public static function resolveCoordinates(
        array $workplace,
        string $organizationNumber = '',
        string $street = '',
        string $zip = '',
        string $city = '',
        string $faumap = ''
    ): array {
        [$lat, $lon] = self::coordinatesFromFaumapUrl($faumap);
        if (null !== $lat && null !== $lon) {
            return [$lat, $lon];
        }

        $famos = self::sanitizeFamosDigits(self::famosFromWorkplace($workplace));
        if ($famos !== '') {
            [$lat, $lon] = self::coordinatesFromFamos($famos);
            if (null !== $lat && null !== $lon) {
                return [$lat, $lon];
            }
        }

        $org = FauMapIframe::sanitizeOrganizationDigits($organizationNumber);
        if ($org !== '') {
            [$lat, $lon] = self::coordinatesFromOrganization($org, $street, $zip, $city);
            if (null !== $lat && null !== $lon) {
                return [$lat, $lon];
            }
        }

        return [null, null];
    }

    /**
     * Parse coordinates from a campus-map URL without HTTP (editor bulk payload).
     * Only an explicit center/lat,lon path segment is used; famos segments are ignored here
     * because resolving them would require the GeoJSON API.
     *
     * @return array{0: ?float, 1: ?float}
     */
    public static function parseLocalCoordinatesFromFaumap(string $faumap): array
    {
        $faumap = trim($faumap);
        if ($faumap === '') {
            return [null, null];
        }

        $parts = wp_parse_url($faumap);
        if (!is_array($parts)) {
            return [null, null];
        }

        $path = trim((string) ($parts['path'] ?? ''), '/');
        if ($path === '') {
            return [null, null];
        }

        $segments = explode('/', $path);
        $count    = count($segments);

        for ($i = 0; $i < $count - 1; ++$i) {
            $key = strtolower($segments[$i]);
            $val = rawurldecode($segments[$i + 1]);

            if ($key === 'center') {
                return self::parseCenterPair($val);
            }
        }

        return [null, null];
    }

    /**
     * Coordinates from a karte.fau.de iframe URL ({@code center/…} or {@code famos/…}).
     *
     * @return array{0: ?float, 1: ?float}
     */
    public static function coordinatesFromIframeUrl(string $faumap): array
    {
        return self::coordinatesFromFaumapUrl($faumap);
    }

    /**
     * @return array{0: ?float, 1: ?float}
     */
    private static function coordinatesFromFaumapUrl(string $faumap): array
    {
        $faumap = trim($faumap);
        if ($faumap === '') {
            return [null, null];
        }

        $parts = wp_parse_url($faumap);
        if (!is_array($parts)) {
            return [null, null];
        }

        $path = trim((string) ($parts['path'] ?? ''), '/');
        if ($path === '') {
            return [null, null];
        }

        $segments = explode('/', $path);
        $count    = count($segments);

        for ($i = 0; $i < $count - 1; ++$i) {
            $key = strtolower($segments[$i]);
            $val = rawurldecode($segments[$i + 1]);

            if ($key === 'center') {
                return self::parseCenterPair($val);
            }

            if ($key === 'famos') {
                $famos = self::sanitizeFamosDigits($val);
                if ($famos !== '') {
                    return self::coordinatesFromFamos($famos);
                }
            }
        }

        return [null, null];
    }

    /**
     * @return array{0: ?float, 1: ?float}
     */
    private static function coordinatesFromFamos(string $famos): array
    {
        $features = self::fetchFeatures(sprintf('%s/famos/%s', self::API_GEOJSON_PATH, $famos));

        return self::coordinatesFromFeature($features[0] ?? null);
    }

    /**
     * @return array{0: ?float, 1: ?float}
     */
    private static function coordinatesFromOrganization(
        string $org,
        string $street,
        string $zip,
        string $city
    ): array {
        $features = self::fetchFeatures(sprintf('%s/org/%s', self::API_GEOJSON_PATH, $org));
        if ($features === []) {
            return [null, null];
        }

        $feature = self::matchFeatureByAddress($features, $street, $zip, $city);

        return self::coordinatesFromFeature($feature);
    }

    /**
     * @param array<int, array<string, mixed>> $features
     */
    private static function matchFeatureByAddress(
        array $features,
        string $street,
        string $zip,
        string $city
    ): ?array {
        if ($features === []) {
            return null;
        }

        $streetNorm = self::normalizeAddressToken($street);
        $zipNorm    = self::normalizeAddressToken($zip);
        $cityNorm   = self::normalizeAddressToken($city);

        if ($streetNorm === '' && $zipNorm === '' && $cityNorm === '') {
            return count($features) === 1 ? $features[0] : null;
        }

        foreach ($features as $feature) {
            if (!is_array($feature)) {
                continue;
            }

            $props = is_array($feature['properties'] ?? null) ? $feature['properties'] : [];

            if ($streetNorm !== '' && self::normalizeAddressToken((string) ($props['strasse'] ?? '')) !== $streetNorm) {
                continue;
            }

            if ($zipNorm !== '' && self::normalizeAddressToken((string) ($props['plz'] ?? '')) !== $zipNorm) {
                continue;
            }

            if ($cityNorm !== '' && self::normalizeAddressToken((string) ($props['ort'] ?? '')) !== $cityNorm) {
                continue;
            }

            return $feature;
        }

        return count($features) === 1 ? $features[0] : null;
    }

    /**
     * @param array<string,mixed>|null $feature
     *
     * @return array{0: ?float, 1: ?float}
     */
    private static function coordinatesFromFeature(?array $feature): array
    {
        if (!is_array($feature)) {
            return [null, null];
        }

        $geometry = $feature['geometry'] ?? null;
        if (!is_array($geometry) || ($geometry['type'] ?? '') !== 'Point') {
            return [null, null];
        }

        $coords = $geometry['coordinates'] ?? null;
        if (!is_array($coords) || count($coords) < 2) {
            return [null, null];
        }

        $lon = $coords[0];
        $lat = $coords[1];

        if (!is_numeric($lat) || !is_numeric($lon)) {
            return [null, null];
        }

        $latF = (float) $lat;
        $lonF = (float) $lon;

        if (!is_finite($latF) || !is_finite($lonF)) {
            return [null, null];
        }

        return [$latF, $lonF];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function fetchFeatures(string $apiPath): array
    {
        $apiPath = '/' . trim($apiPath, '/');

        return ApiCache::remember(
            'geojson',
            $apiPath,
            static function () use ($apiPath): array {
                return self::fetchFeaturesFromRemote($apiPath);
            },
            static fn (array $features): bool => $features === []
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function fetchFeaturesFromRemote(string $apiPath): array
    {
        $url = sprintf('https://%s%s', self::HOST_SUFFIX, $apiPath);

        $response = wp_remote_get(
            $url,
            [
                'timeout'     => 8,
                'redirections' => 2,
                'headers'     => [
                    'Accept' => 'application/json',
                ],
            ]
        );

        if (is_wp_error($response)) {
            return [];
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        if ($code < 200 || $code >= 300) {
            return [];
        }

        $body = wp_remote_retrieve_body($response);
        if (!is_string($body) || $body === '') {
            return [];
        }

        $decoded = json_decode($body, true);

        return self::decodeFeatures($decoded);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function decodeFeatures(mixed $decoded): array
    {
        if (!is_array($decoded)) {
            return [];
        }

        if (($decoded['type'] ?? '') === 'FeatureCollection') {
            $features = $decoded['features'] ?? [];

            return is_array($features) ? array_values(array_filter($features, 'is_array')) : [];
        }

        if (isset($decoded[0]) && is_array($decoded[0]) && ($decoded[0]['type'] ?? '') === 'Feature') {
            return array_values(array_filter($decoded, 'is_array'));
        }

        if (($decoded['type'] ?? '') === 'Feature') {
            return [$decoded];
        }

        return [];
    }

    /**
     * @return array{0: ?float, 1: ?float}
     */
    private static function parseCenterPair(string $pair): array
    {
        $pair = trim(rawurldecode($pair));
        if ($pair === '') {
            return [null, null];
        }

        $parts = array_map('trim', explode(',', $pair, 2));
        if (count($parts) !== 2) {
            return [null, null];
        }

        $lat = self::parseCoordinate($parts[0]);
        $lon = self::parseCoordinate($parts[1]);

        return [$lat, $lon];
    }

    private static function parseCoordinate(string $value): ?float
    {
        $value = str_replace(',', '.', trim($value));
        if ($value === '' || !is_numeric($value)) {
            return null;
        }

        $f = (float) $value;

        return is_finite($f) ? $f : null;
    }

    private static function normalizeAddressToken(string $value): string
    {
        $value = strtolower(trim($value));
        if ($value === '') {
            return '';
        }

        $value = remove_accents($value);

        return preg_replace('/\s+/', '', $value) ?? '';
    }

    private static function sanitizeFamosDigits(string $raw): string
    {
        $digits = preg_replace('/\D+/', '', trim($raw));

        if (!is_string($digits) || $digits === '' || strlen($digits) > 5) {
            return '';
        }

        return $digits;
    }

    /** @param array<string,mixed> $workplace */
    private static function famosFromWorkplace(array $workplace): string
    {
        foreach (['famos', 'buildingNumber', 'building', 'famosNumber'] as $key) {
            if (!isset($workplace[$key])) {
                continue;
            }

            $value = $workplace[$key];
            if (is_string($value) || is_int($value)) {
                $digits = self::sanitizeFamosDigits((string) $value);
                if ($digits !== '') {
                    return $digits;
                }
            }
        }

        return '';
    }
}
