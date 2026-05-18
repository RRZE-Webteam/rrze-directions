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

    /** @var array<string, string> */
    private static array $canonicalCache = [];

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
     * Resolve HTTP redirects and famos aliases to the final iframe API URL.
     */
    public static function canonicalIframeSrc(string $url): string
    {
        $url = trim($url);
        if ($url === '' || !self::isApiIframeUrl($url)) {
            return $url;
        }

        if (isset(self::$canonicalCache[$url])) {
            return self::$canonicalCache[$url];
        }

        $resolved = self::followHttpRedirects($url);
        $resolved = self::preferCenterIframeUrl($resolved);
        self::$canonicalCache[$url] = $resolved;

        return $resolved;
    }

    /**
     * Escapes and returns a safe HTTPS iframe src, or empty if invalid.
     */
    public static function escIframeSrc(string $url): string
    {
        if (!self::isApiIframeUrl($url)) {
            return '';
        }

        $url = self::canonicalIframeSrc($url);
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
        $lat = self::parseCoordinate($attributes['mapLatitude'] ?? null);
        $lon = self::parseCoordinate($attributes['mapLongitude'] ?? null);
        $centerFromCoords = null !== $lat && null !== $lon
            ? sprintf(
                'https://%s/api/v1/iframe/center/%s/zoom/16/',
                self::HOST_SUFFIX,
                rawurlencode($lat . ',' . $lon)
            )
            : '';

        $mapUrl = trim((string) ($attributes['mapUrl'] ?? ''));
        if ($mapUrl !== '') {
            if ($centerFromCoords !== '' && self::iframePathHasSegment($mapUrl, 'famos')) {
                $direct = self::escIframeSrc($centerFromCoords);
                if ($direct !== '') {
                    return $direct;
                }
            }

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

        if ($centerFromCoords !== '') {
            return self::escIframeSrc($centerFromCoords);
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

    private static function followHttpRedirects(string $url): string
    {
        $response = wp_remote_head(
            $url,
            [
                'timeout'     => 8,
                'redirection' => 5,
                'headers'     => [
                    'Accept' => 'text/html,application/xhtml+xml',
                ],
            ]
        );

        if (is_wp_error($response)) {
            return $url;
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        if ($code === 405 || $code === 501) {
            $response = wp_remote_get(
                $url,
                [
                    'timeout'     => 8,
                    'redirection' => 5,
                    'headers'     => [
                        'Accept' => 'text/html,application/xhtml+xml',
                    ],
                ]
            );

            if (is_wp_error($response)) {
                return $url;
            }

            $code = (int) wp_remote_retrieve_response_code($response);
        }

        if ($code < 200 || $code >= 400) {
            return $url;
        }

        $final = self::finalUrlFromResponse($response, $url);

        return self::isApiIframeUrl($final) ? $final : $url;
    }

    /**
     * famos/… iframe URLs resolve to a center/… view; use that stable URL when possible.
     */
    private static function preferCenterIframeUrl(string $url): string
    {
        if (!self::isApiIframeUrl($url) || self::iframePathHasSegment($url, 'center')) {
            return $url;
        }

        if (!self::iframePathHasSegment($url, 'famos')) {
            return $url;
        }

        [$lat, $lon] = FauMapGeojson::coordinatesFromIframeUrl($url);
        if (null === $lat || null === $lon) {
            return $url;
        }

        $pair = $lat . ',' . $lon;

        return sprintf(
            'https://%s/api/v1/iframe/center/%s/zoom/16/',
            self::HOST_SUFFIX,
            rawurlencode($pair)
        );
    }

    private static function iframePathHasSegment(string $url, string $segment): bool
    {
        $parts = wp_parse_url($url);
        if (!is_array($parts)) {
            return false;
        }

        $path = strtolower(trim((string) ($parts['path'] ?? ''), '/'));
        if ($path === '') {
            return false;
        }

        return in_array(strtolower($segment), explode('/', $path), true);
    }

    /**
     * @param array<string, mixed> $response
     */
    private static function finalUrlFromResponse(array $response, string $fallback): string
    {
        if (!isset($response['http_response']) || !is_object($response['http_response'])) {
            return $fallback;
        }

        $obj = $response['http_response']->get_response_object();
        if ($obj instanceof \WpOrg\Requests\Response && is_string($obj->url) && $obj->url !== '') {
            return $obj->url;
        }

        return $fallback;
    }
}
