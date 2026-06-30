<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Transport-mode and start-point icons (Dashicons + inline SVG fallbacks).
 */
final class ModeIcons
{
    public static function enqueueDashicons(): void
    {
        if (!wp_style_is('dashicons', 'enqueued')) {
            wp_enqueue_style('dashicons');
        }
    }

    public static function modeIconHtml(string $modeKey): string
    {
        return match ($modeKey) {
            'bike'    => self::svgBike(),
            'car'     => self::dashicon('car'),
            'transit' => self::svgTransit(),
            default   => '',
        };
    }

    public static function startIconHtml(string $startKey): string
    {
        return match ($startKey) {
            'nuernberg_airport' => self::dashicon('airplane'),
            'erlangen', 'nuernberg' => self::svgTrain(),
            default => self::dashicon('location'),
        };
    }

    private static function dashicon(string $name): string
    {
        return '<span class="rrze-directions__pill-icon dashicons dashicons-' . esc_attr($name) . '" aria-hidden="true"></span>';
    }

    private static function svgWrap(string $pathD, string $extra = ''): string
    {
        return '<svg class="rrze-directions__pill-icon rrze-directions__pill-icon--svg" xmlns="http://www.w3.org/2000/svg"'
            . ' viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">'
            . '<path fill="currentColor" d="' . esc_attr($pathD) . '"' . $extra . '/>'
            . '</svg>';
    }

    private static function svgBike(): string
    {
        return self::svgWrap(
            'M5.2 15.5a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4zm9.1 0a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4zM7.1 13.3l1.4-3.6 2.2 1.3 2.5-2.8h2.1l-3.4 3.8-2.4-.9-1.2 3.1H7.1zm.9-5.8L8.8 5h2.9l-.8 2.5H8z'
        );
    }

    private static function svgTransit(): string
    {
        return self::svgWrap(
            'M3 5.5h14v7.5H3V5.5zm1.5 1.5v4.5h11V7H4.5zm1.2 8.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm9.1 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM6.2 4h1.3l.6 1.5h4.6L13.3 4h1.3l-.9 2.2H7.1L6.2 4z'
        );
    }

    private static function svgTrain(): string
    {
        return self::svgWrap(
            'M4 5.5h12v8H4v-8zm1.5 1.5v5h9V7h-9zm1.8 8.5a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm7.9 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM7.2 3.8h5.6l.7 1.7H6.5l.7-1.7z'
        );
    }
}
