<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Leaflet route map markup (ORS geometry) shown above direction step lists.
 */
final class RouteMapPresentation
{
    public static function render(string $routeJson): string
    {
        $routeJson = trim($routeJson);
        if ($routeJson === '') {
            return '';
        }

        $decoded = json_decode($routeJson, true);
        if (!is_array($decoded) || !self::isValidRouteData($decoded)) {
            return '';
        }

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

    /**
     * @param list<array{startKey: string, startLabel: string, route: array<string, mixed>}> $variants
     */
    public static function encodeVariantsJson(array $variants): string
    {
        if ($variants === []) {
            return '';
        }

        $encoded = wp_json_encode(['variants' => $variants]);

        return is_string($encoded) ? $encoded : '';
    }

    /**
     * @return list<array{startKey: string, startLabel: string, route: array<string, mixed>}>
     */
    public static function parseVariants(string $routeJson): array
    {
        $routeJson = trim($routeJson);
        if ($routeJson === '') {
            return [];
        }

        $decoded = json_decode($routeJson, true);
        if (!is_array($decoded)) {
            return [];
        }

        if (isset($decoded['variants']) && is_array($decoded['variants'])) {
            $variants = [];

            foreach ($decoded['variants'] as $variant) {
                if (!is_array($variant)) {
                    continue;
                }

                $route = $variant['route'] ?? null;
                if (!is_array($route) || !self::isValidRouteData($route)) {
                    continue;
                }

                $variants[] = [
                    'startKey'   => (string) ($variant['startKey'] ?? ''),
                    'startLabel' => (string) ($variant['startLabel'] ?? ''),
                    'route'      => $route,
                ];
            }

            return $variants;
        }

        if (self::isValidRouteData($decoded)) {
            return [
                [
                    'startKey'   => '',
                    'startLabel' => '',
                    'route'      => $decoded,
                ],
            ];
        }

        return [];
    }

    /**
     * @param array<string, mixed> $route
     */
    private static function isValidRouteData(array $route): bool
    {
        $coordinates = $route['coordinates'] ?? null;
        $steps       = $route['steps'] ?? null;

        return is_array($coordinates)
            && count($coordinates) >= 2
            && is_array($steps)
            && $steps !== [];
    }
}
