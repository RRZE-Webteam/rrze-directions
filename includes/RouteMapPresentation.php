<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Leaflet route map markup (ORS geometry) shown above direction step lists.
 */
final class RouteMapPresentation
{
    private static bool $assetsEnqueued = false;

    public static function render(string $routeJson): string
    {
        $routeJson = trim($routeJson);
        if ($routeJson === '' || !self::isValidRouteJson($routeJson)) {
            return '';
        }

        self::enqueueAssets();

        return '<div class="rrze-direction-route-map"'
            . ' data-route="' . esc_attr($routeJson) . '">'
            . '<h4 class="rrze-direction-route-map__title">'
            . esc_html__('Route map', 'rrze-direction')
            . '</h4>'
            . '<div class="rrze-direction-route-map__canvas"'
            . ' role="application"'
            . ' aria-label="' . esc_attr__('Interactive route map', 'rrze-direction') . '"'
            . '></div>'
            . '<p class="rrze-direction-route-map__hint">'
            . esc_html__(
                'Click a numbered step in the directions list to highlight it on the map.',
                'rrze-direction'
            )
            . '</p>'
            . '</div>';
    }

    private static function isValidRouteJson(string $routeJson): bool
    {
        $decoded = json_decode($routeJson, true);
        if (!is_array($decoded)) {
            return false;
        }

        $coordinates = $decoded['coordinates'] ?? null;
        $steps       = $decoded['steps'] ?? null;

        return is_array($coordinates)
            && count($coordinates) >= 2
            && is_array($steps)
            && $steps !== [];
    }

    private static function enqueueAssets(): void
    {
        if (self::$assetsEnqueued) {
            return;
        }

        self::$assetsEnqueued = true;

        if (wp_style_is(Main::ROUTE_MAP_STYLE_HANDLE, 'registered')) {
            wp_enqueue_style(Main::ROUTE_MAP_STYLE_HANDLE);
        }

        if (wp_script_is(Main::ROUTE_MAP_SCRIPT_HANDLE, 'registered')) {
            wp_enqueue_script(Main::ROUTE_MAP_SCRIPT_HANDLE);
        }
    }
}
