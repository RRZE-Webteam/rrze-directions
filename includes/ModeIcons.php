<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Transport-mode and start-point icons (inline SVG).
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
            'bike'    => self::inlineSvg('bike.svg'),
            'car'     => self::inlineSvg('car.svg'),
            'transit' => self::inlineSvg('transit.svg'),
            default   => '',
        };
    }

    public static function startIconHtml(string $startKey): string
    {
        return match ($startKey) {
            'nuernberg_airport' => self::dashicon('airplane'),
            'erlangen', 'nuernberg' => self::inlineSvg('transit.svg'),
            default => self::dashicon('location'),
        };
    }

    private static function dashicon(string $name): string
    {
        return '<span class="rrze-directions__pill-icon dashicons dashicons-' . esc_attr($name) . '" aria-hidden="true"></span>';
    }

    private static function inlineSvg(string $filename): string
    {
        $path = dirname(__DIR__) . '/assets/icons/' . $filename;

        if (!is_readable($path)) {
            return '';
        }

        $svg = file_get_contents($path);

        if (!is_string($svg) || $svg === '') {
            return '';
        }

        $svg = preg_replace(
            '/<svg\b/',
            '<svg class="rrze-directions__pill-icon rrze-directions__pill-icon--svg" aria-hidden="true" focusable="false"',
            $svg,
            1
        );

        return is_string($svg) ? $svg : '';
    }
}
