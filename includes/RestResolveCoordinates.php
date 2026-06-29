<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Lazy coordinate resolution for the block editor (avoids bulk requests to karte.fau.de).
 */
final class RestResolveCoordinates
{
    public static function register(): void
    {
        add_action('rest_api_init', [self::class, 'registerRoutes']);
    }

    public static function registerRoutes(): void
    {
        register_rest_route(
            'rrze-directions/v1',
            '/resolve-coordinates',
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'handle'],
                'permission_callback' => static fn(): bool => current_user_can('edit_posts'),
            ]
        );
    }

    public static function handle(\WP_REST_Request $request): \WP_REST_Response
    {
        $params = $request->get_json_params();
        if (!is_array($params)) {
            $params = [];
        }

        $workplace = self::sanitizeMapHints($params['mapHints'] ?? null);

        $org = FauMapIframe::sanitizeOrganizationDigits((string) ($params['organizationNumber'] ?? ''));
        $street = sanitize_text_field((string) ($params['street'] ?? ''));
        $zip    = sanitize_text_field((string) ($params['zip'] ?? ''));
        $city   = sanitize_text_field((string) ($params['city'] ?? ''));
        $faumap = self::sanitizeFaumapUrl((string) ($params['faumap'] ?? ''));

        [$lat, $lon] = FauMapGeojson::resolveCoordinates(
            $workplace,
            $org,
            $street,
            $zip,
            $city,
            $faumap
        );

        return new \WP_REST_Response(
            [
                'latitude'  => $lat,
                'longitude' => $lon,
            ],
            200
        );
    }

    /**
     * @param mixed $raw
     *
     * @return array<string, string>
     */
    private static function sanitizeMapHints(mixed $raw): array
    {
        if (!is_array($raw)) {
            return [];
        }

        $allowed = ['famos', 'buildingNumber', 'building', 'famosNumber'];
        $out     = [];

        foreach ($allowed as $key) {
            if (!array_key_exists($key, $raw)) {
                continue;
            }
            $value = $raw[$key];
            if ($value === null || $value === '') {
                continue;
            }
            if (!is_string($value) && !is_int($value)) {
                continue;
            }
            $out[$key] = (string) $value;
        }

        return $out;
    }

    private static function sanitizeFaumapUrl(string $url): string
    {
        $url = trim($url);
        if ($url === '') {
            return '';
        }

        $parts = wp_parse_url($url);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return '';
        }

        $scheme = strtolower((string) $parts['scheme']);
        if (!in_array($scheme, ['http', 'https'], true)) {
            return '';
        }

        $host = strtolower((string) $parts['host']);
        if (!str_ends_with($host, 'karte.fau.de')) {
            return '';
        }

        $out = esc_url_raw($url);

        return is_string($out) ? $out : '';
    }
}
