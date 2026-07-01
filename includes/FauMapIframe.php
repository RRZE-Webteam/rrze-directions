<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Builds embeddable map URLs for https://karte.fau.de (see API documentation).
 *
 * Marker pins require famos, org, address, or term — not center/… alone.
 *
 * @link https://karte.fau.de/api/doc
 */
final class FauMapIframe
{
    private const HOST_SUFFIX = 'karte.fau.de';

    private const API_IFRAME_PATH = '/api/v1/iframe';

    /** @var list<string> */
    private const MARKER_PATH_SEGMENTS = ['famos', 'org', 'address', 'term'];

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
     * Follow HTTP redirects only — keep famos/org/address URLs (they show map pins).
     */
    public static function canonicalIframeSrc(string $url): string
    {
        $url = trim($url);
        if ($url === '' || !self::isApiIframeUrl($url)) {
            return $url;
        }

        return ApiCache::remember(
            'iframe',
            $url,
            static fn (): string => self::followHttpRedirects($url)
        );
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
     * Resolve iframe src that shows a location marker when possible.
     *
     * @param array<string,mixed> $attributes
     */
    public static function resolveIframeSrc(array $attributes): string
    {
        $mapUrl = trim((string) ($attributes['mapUrl'] ?? ''));

        if ($mapUrl !== '' && self::isApiIframeUrl($mapUrl)) {
            if (self::iframeHasMarkerSegment($mapUrl)) {
                $direct = self::escIframeSrc($mapUrl);
                if ($direct !== '') {
                    return $direct;
                }
            }
        }

        $famos = self::famosFromIframeUrl($mapUrl);
        if ($famos !== '') {
            $direct = self::escIframeSrc(self::buildFamosIframeUrl($famos));
            if ($direct !== '') {
                return $direct;
            }
        }

        if (self::isManualLocationMode($attributes)) {
            return self::resolveManualIframeSrc($attributes);
        }

        $org = self::sanitizeOrganizationDigits((string) ($attributes['organizationNumber'] ?? ''));
        if ($org !== '') {
            $direct = self::escIframeSrc(self::buildOrgIframeUrl($org, $attributes));
            if ($direct !== '') {
                return $direct;
            }
        }

        $street = (string) ($attributes['addressStreet'] ?? '');
        $zip    = (string) ($attributes['addressZip'] ?? '');
        $city   = (string) ($attributes['addressCity'] ?? '');

        $addressQuery = self::buildAddressParam($street, $zip, $city);
        if ($addressQuery !== '') {
            $direct = self::escIframeSrc(self::buildAddressIframeUrl($addressQuery));
            if ($direct !== '') {
                return $direct;
            }
        }

        $lat = self::parseCoordinate($attributes['mapLatitude'] ?? null);
        $lon = self::parseCoordinate($attributes['mapLongitude'] ?? null);
        if (null !== $lat && null !== $lon) {
            $direct = self::escIframeSrc(self::buildCenterIframeUrl($lat, $lon));
            if ($direct !== '') {
                return $direct;
            }
        }

        if ($mapUrl !== '' && self::isApiIframeUrl($mapUrl)) {
            return self::escIframeSrc($mapUrl);
        }

        return '';
    }

    /**
     * @param array<string,mixed> $attributes
     */
    private static function isManualLocationMode(array $attributes): bool
    {
        return ((int) ($attributes['personId'] ?? 0)) <= 0;
    }

    /**
     * Manual map: link or coordinates only (ignore leftover FAUdir address fields).
     *
     * @param array<string,mixed> $attributes
     */
    private static function resolveManualIframeSrc(array $attributes): string
    {
        $mapUrl = trim((string) ($attributes['mapUrl'] ?? ''));

        if ($mapUrl !== '' && self::isApiIframeUrl($mapUrl)) {
            $direct = self::escIframeSrc($mapUrl);
            if ($direct !== '') {
                return $direct;
            }
        }

        $lat = self::parseCoordinate($attributes['mapLatitude'] ?? null);
        $lon = self::parseCoordinate($attributes['mapLongitude'] ?? null);
        if (null !== $lat && null !== $lon) {
            $direct = self::escIframeSrc(self::buildCenterIframeUrl($lat, $lon));
            if ($direct !== '') {
                return $direct;
            }
        }

        return '';
    }

    private static function buildFamosIframeUrl(string $famos): string
    {
        return sprintf(
            'https://%s/api/v1/iframe/famos/%s/',
            self::HOST_SUFFIX,
            rawurlencode($famos)
        );
    }

    /**
     * @param array<string,mixed> $attributes
     */
    private static function buildOrgIframeUrl(string $org, array $attributes): string
    {
        $street = (string) ($attributes['addressStreet'] ?? '');
        $zip    = (string) ($attributes['addressZip'] ?? '');
        $city   = (string) ($attributes['addressCity'] ?? '');

        $addressQuery = self::buildAddressParam($street, $zip, $city);
        if ($addressQuery !== '') {
            return sprintf(
                'https://%s/api/v1/iframe/org/%s/address/%s/',
                self::HOST_SUFFIX,
                $org,
                rawurlencode($addressQuery)
            );
        }

        return sprintf('https://%s/api/v1/iframe/org/%s/', self::HOST_SUFFIX, $org);
    }

    private static function buildAddressIframeUrl(string $addressQuery): string
    {
        return sprintf(
            'https://%s/api/v1/iframe/address/%s/',
            self::HOST_SUFFIX,
            rawurlencode($addressQuery)
        );
    }

    private static function buildCenterIframeUrl(float $lat, float $lon): string
    {
        return sprintf(
            'https://%s/api/v1/iframe/center/%s/zoom/16/',
            self::HOST_SUFFIX,
            rawurlencode($lat . ',' . $lon)
        );
    }

    private static function iframeHasMarkerSegment(string $url): bool
    {
        foreach (self::MARKER_PATH_SEGMENTS as $segment) {
            if (self::iframePathHasSegment($url, $segment)) {
                return true;
            }
        }

        return false;
    }

    private static function famosFromIframeUrl(string $url): string
    {
        if (!self::isApiIframeUrl($url)) {
            return '';
        }

        $parts = wp_parse_url($url);
        if (!is_array($parts)) {
            return '';
        }

        $path = trim((string) ($parts['path'] ?? ''), '/');
        if ($path === '') {
            return '';
        }

        $segments = explode('/', $path);
        $count    = count($segments);

        for ($i = 0; $i < $count - 1; ++$i) {
            if (strtolower($segments[$i]) !== 'famos') {
                continue;
            }

            return self::sanitizeFamosDigits(rawurldecode($segments[$i + 1]));
        }

        return '';
    }

    private static function sanitizeFamosDigits(string $raw): string
    {
        $digits = preg_replace('/\D+/', '', trim($raw));

        if (!is_string($digits) || $digits === '' || strlen($digits) > 5) {
            return '';
        }

        return $digits;
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
                'redirections' => 5,
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
                    'redirections' => 5,
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
