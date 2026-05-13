<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * REST: prefill direction RichText from OpenRouteService using regional main stations as start.
 */
final class RestOpenRouteDirections
{
    public static function register(): void
    {
        add_action('rest_api_init', [self::class, 'registerRoutes']);
    }

    public static function registerRoutes(): void
    {
        register_rest_route(
            'rrze-direction/v1',
            '/openroute-directions',
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

        $city = sanitize_text_field((string) ($params['city'] ?? ''));
        $lat  = MapLinks::parseCoordinate($params['latitude'] ?? null);
        $lon  = MapLinks::parseCoordinate($params['longitude'] ?? null);

        if ($city === '' || null === $lat || null === $lon) {
            return new \WP_REST_Response(
                [
                    'directionBike'    => '',
                    'directionCar'     => '',
                    'directionTransit' => '',
                ],
                200
            );
        }

        $start = RegionalStationOrigin::startLonLatForCity($city);
        if (null === $start) {
            return new \WP_REST_Response(
                [
                    'directionBike'    => '',
                    'directionCar'     => '',
                    'directionTransit' => '',
                ],
                200
            );
        }

        $apiKey = Settings::getOpenRouteServiceApiKey();
        if ($apiKey === '') {
            return new \WP_REST_Response(
                [
                    'directionBike'    => '',
                    'directionCar'     => '',
                    'directionTransit' => '',
                ],
                200
            );
        }

        [$startLon, $startLat] = $start;

        $dirs = OpenRouteDirections::fetchDirectionHtml(
            $apiKey,
            $startLon,
            $startLat,
            $lon,
            $lat
        );

        return new \WP_REST_Response(
            [
                'directionBike'    => $dirs['bike'],
                'directionCar'     => $dirs['car'],
                'directionTransit' => $dirs['transit'],
            ],
            200
        );
    }
}
