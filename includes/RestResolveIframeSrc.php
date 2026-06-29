<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Resolves karte.fau.de iframe URLs to their canonical form (HTTP redirects only).
 */
final class RestResolveIframeSrc
{
    public static function register(): void
    {
        add_action('rest_api_init', [self::class, 'registerRoutes']);
    }

    public static function registerRoutes(): void
    {
        register_rest_route(
            'rrze-directions/v1',
            '/resolve-iframe-src',
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

        $url = trim((string) ($params['url'] ?? ''));
        if ($url === '' && is_array($params['attributes'] ?? null)) {
            $url = FauMapIframe::resolveIframeSrc($params['attributes']);
        }

        if ($url === '') {
            return new \WP_REST_Response(
                [
                    'iframeSrc' => '',
                    'mapUrl'    => '',
                ],
                200
            );
        }

        $canonical = FauMapIframe::canonicalIframeSrc($url);
        if (!FauMapIframe::isApiIframeUrl($canonical)) {
            $canonical = $url;
        }

        return new \WP_REST_Response(
            [
                'iframeSrc' => $canonical,
                'mapUrl'    => $canonical,
            ],
            200
        );
    }
}
