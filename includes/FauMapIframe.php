<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Builds embeddable map URLs for https://karte.fau.de (see API documentation).
 *
 * @link https://karte.fau.de/api/doc
 */
final class FauMapIframe
{
    private const HOST_SUFFIX = 'karte.fau.de';

    private const API_IFRAME_PATH = '/api/v1/iframe';

    /**
     * Whether $url is a karte.fau.de iframe API URL (safe to use as iframe src).
     */
    public static function isApiIframeUrl(string $url): bool
    {
        $parts = wp_parse_url($url);
        if (!is_array($parts) || empty($parts['host'])) {
            return false;
        }

        $host = strtolower((string) $parts['host']);

        return str_ends_with($host, self::HOST_SUFFIX)
            && str_contains((string) ($parts['path'] ?? ''), self::API_IFRAME_PATH);
    }

    /**
     * Escapes and returns a safe HTTPS iframe src, or empty if invalid.
     */
    public static function escIframeSrc(string $url): string
    {
        if (!self::isApiIframeUrl($url)) {
            return '';
        }

        $out = esc_url($url, ['https']);

        return is_string($out) ? $out : '';
    }

    /**
     * Sanitize FAU organisation number (digits, max length per karte.fau.de API).
     */
    public static function sanitizeOrganizationDigits(string $raw): string
    {
        $raw = trim($raw);
        if ($raw === '') {
            return '';
        }

        if (class_exists(\RRZE\FAUdir\FaudirUtils::class)) {
            $via = \RRZE\FAUdir\FaudirUtils::sanitizeOrgnr($raw);

            return $via ?? '';
        }

        $digits = preg_replace('/\D+/', '', $raw);

        return is_string($digits) && strlen($digits) <= 10 ? $digits : '';
    }

    /**
     * Resolve the best iframe src from block attributes (priority: explicit API URL → org → center → address).
     *
     * @param array<string,mixed> $attributes
     */
    public static function resolveIframeSrc(array $attributes): string
    {
        $mapUrl = trim((string) ($attributes['mapUrl'] ?? ''));
        if ($mapUrl !== '') {
            $direct = self::escIframeSrc($mapUrl);
            if ($direct !== '') {
                return $direct;
            }
        }

        $org = self::sanitizeOrganizationDigits((string) ($attributes['organizationNumber'] ?? ''));
        if ($org !== '') {
            $candidate = sprintf('https://%s/api/v1/iframe/org/%s/', self::HOST_SUFFIX, $org);

            return self::escIframeSrc($candidate);
        }

        $lat = self::parseCoordinate($attributes['mapLatitude'] ?? null);
        $lon = self::parseCoordinate($attributes['mapLongitude'] ?? null);
        if (null !== $lat && null !== $lon) {
            // API: center = Breite,Länge (latitude, longitude).
            $pair      = $lat . ',' . $lon;
            $candidate = sprintf(
                'https://%s/api/v1/iframe/center/%s/zoom/16/',
                self::HOST_SUFFIX,
                rawurlencode($pair)
            );

            return self::escIframeSrc($candidate);
        }

        $street = (string) ($attributes['addressStreet'] ?? '');
        $zip    = (string) ($attributes['addressZip'] ?? '');
        $city   = (string) ($attributes['addressCity'] ?? '');

        $addressQuery = self::buildAddressParam($street, $zip, $city);
        if ($addressQuery !== '') {
            $candidate = sprintf(
                'https://%s/api/v1/iframe/address/%s/',
                self::HOST_SUFFIX,
                rawurlencode($addressQuery)
            );

            return self::escIframeSrc($candidate);
        }

        return '';
    }

    /**
     * @param float|int|string|null $value
     */
    private static function parseCoordinate(mixed $value): ?float
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

    private static function buildAddressParam(string $street, string $zip, string $city): string
    {
        $cityLine = trim(implode(' ', array_filter([$zip, $city])));

        return implode(
            ',',
            array_filter([trim($street), $cityLine], static fn(string $p): bool => $p !== '')
        );
    }
}
