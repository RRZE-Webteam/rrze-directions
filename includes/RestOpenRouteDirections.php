<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * REST: prefill direction RichText from OpenRouteService using all regional main stations as starts.
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
        if (function_exists('set_time_limit')) {
            @set_time_limit(90);
        }

        $params = $request->get_json_params();
        if (!is_array($params)) {
            $params = [];
        }

        $city             = sanitize_text_field((string) ($params['city'] ?? ''));
        $zip              = sanitize_text_field((string) ($params['zip'] ?? ''));
        $street           = sanitize_text_field((string) ($params['street'] ?? ''));
        $formattedAddress = sanitize_text_field((string) ($params['formattedAddress'] ?? ''));
        $lat              = MapLinks::parseCoordinate($params['latitude'] ?? null);
        $lon              = MapLinks::parseCoordinate($params['longitude'] ?? null);

        $empty = static fn(): \WP_REST_Response => new \WP_REST_Response(
            [
                'directionBike'        => '',
                'directionCar'         => '',
                'directionTransit'     => '',
                'directionBikeRoute'   => '',
                'directionCarRoute'    => '',
                'directionTransitRoute'=> '',
            ],
            200
        );

        if (null === $lat || null === $lon) {
            return $empty();
        }

        $apiKey = Settings::getOpenRouteServiceApiKey();
        if ($apiKey === '') {
            return $empty();
        }

        $orsLang = OpenRouteDirections::orsLanguageFromWpLocale(
            OpenRouteDirections::siteLocaleForDirections()
        );

        $toLabel = AddressPresentation::destinationLine($street, $zip, $city, $formattedAddress);

        $dirs = OpenRouteDirections::fetchDirectionsFromAllStarts(
            $apiKey,
            $lon,
            $lat,
            $orsLang,
            $toLabel
        );

        return new \WP_REST_Response(
            [
                'directionBike'         => $dirs['bike']['html'],
                'directionCar'          => $dirs['car']['html'],
                'directionTransit'      => $dirs['transit']['html'],
                'directionBikeRoute'    => $dirs['bike']['route'],
                'directionCarRoute'     => $dirs['car']['route'],
                'directionTransitRoute' => $dirs['transit']['route'],
            ],
            200
        );
    }
}
