<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Renders direction sections (foot, car, transit) as accordion or column grid.
 */
final class DirectionsPresentation
{
    /**
     * @return list<array{key: string, title: string, html: string, route: string}>
     */
    public static function visibleSections(array $attributes): array
    {
        $definitions = [
            [
                'key'     => 'bike',
                'enabled' => self::isTypeEnabled($attributes, 'showDirectionBike'),
                'content' => (string) ($attributes['directionBike'] ?? ''),
                'route'   => (string) ($attributes['directionBikeRoute'] ?? ''),
                'title'   => __('Walking / Cycling', 'rrze-direction'),
            ],
            [
                'key'     => 'car',
                'enabled' => self::isTypeEnabled($attributes, 'showDirectionCar'),
                'content' => (string) ($attributes['directionCar'] ?? ''),
                'route'   => (string) ($attributes['directionCarRoute'] ?? ''),
                'title'   => __('By car', 'rrze-direction'),
            ],
            [
                'key'     => 'transit',
                'enabled' => self::isTypeEnabled($attributes, 'showDirectionTransit'),
                'content' => (string) ($attributes['directionTransit'] ?? ''),
                'route'   => (string) ($attributes['directionTransitRoute'] ?? ''),
                'title'   => __('Bus / train', 'rrze-direction'),
            ],
        ];

        $sections = [];

        foreach ($definitions as $definition) {
            if (!$definition['enabled'] || !self::hasContent($definition['content'])) {
                continue;
            }

            $sections[] = [
                'key'   => $definition['key'],
                'title' => $definition['title'],
                'html'  => $definition['content'],
                'route' => $definition['route'],
            ];
        }

        return $sections;
    }

    public static function render(array $attributes): string
    {
        $sections = self::visibleSections($attributes);

        if ($sections === []) {
            return '';
        }

        $layout = self::normalizeLayout((string) ($attributes['directionsLayout'] ?? 'accordion'));

        if ($layout === 'columns') {
            return self::renderColumns($sections);
        }

        return self::renderAccordion($sections);
    }

    private static function isTypeEnabled(array $attributes, string $attributeKey): bool
    {
        if (!array_key_exists($attributeKey, $attributes)) {
            return true;
        }

        return (bool) $attributes[$attributeKey];
    }

    private static function hasContent(string $html): bool
    {
        return trim(wp_strip_all_tags($html)) !== '';
    }

    private static function normalizeLayout(string $layout): string
    {
        return $layout === 'columns' ? 'columns' : 'accordion';
    }

    /**
     * @param list<array{key: string, title: string, html: string, route: string}> $sections
     */
    private static function renderAccordion(array $sections): string
    {
        self::enqueueAccordionAssets();

        $items = '';

        foreach ($sections as $index => $section) {
            $anchor = wp_unique_id('rrze-direction-' . $section['key'] . '-');
            $open   = $index === 0 ? ' open' : '';

            $items .= '<details'
                . $open
                . ' id="' . esc_attr($anchor) . '"'
                . ' class="rrze-answers-item is-fau">'
                . '<summary>' . esc_html($section['title']) . '</summary>'
                . '<div class="rrze-answers-content">'
                . self::renderSectionBody($section)
                . '</div>'
                . '</details>';
        }

        return '<div class="rrze-direction__directions rrze-answers"'
            . ' data-accordion="single"'
            . ' data-scroll-offset="96"'
            . ' role="region"'
            . ' aria-label="' . esc_attr__('Directions', 'rrze-direction') . '">'
            . $items
            . '</div>';
    }

    /**
     * @param list<array{key: string, title: string, html: string, route: string}> $sections
     */
    private static function renderColumns(array $sections): string
    {
        $count = count($sections);
        $cols  = match (true) {
            $count >= 3 => 3,
            $count === 2 => 2,
            default => 1,
        };

        $items = '';

        foreach ($sections as $section) {
            $items .= '<section class="rrze-direction__text rrze-direction__text--column">'
                . '<h3>' . esc_html($section['title']) . '</h3>'
                . self::renderSectionBody($section)
                . '</section>';
        }

        return '<div class="rrze-direction__directions rrze-direction__directions-grid'
            . ' rrze-direction__directions-grid--cols-' . esc_attr((string) $cols)
            . '" role="region"'
            . ' aria-label="' . esc_attr__('Directions', 'rrze-direction') . '">'
            . $items
            . '</div>';
    }

    /**
     * @param array{key: string, title: string, html: string, route: string} $section
     */
    private static function renderSectionBody(array $section): string
    {
        $html = RouteMapPresentation::render($section['route']);
        $html .= '<div class="rrze-direction__rte">' . wp_kses_post($section['html']) . '</div>';

        return $html;
    }

    private static function enqueueAccordionAssets(): void
    {
        if (wp_style_is('rrze-answers-css', 'registered')) {
            wp_enqueue_style('rrze-answers-css');
        }

        if (wp_script_is('rrze-answers-accordion', 'registered')) {
            wp_enqueue_script('rrze-answers-accordion');

            return;
        }

        if (wp_script_is(Main::ACCORDION_SCRIPT_HANDLE, 'registered')) {
            wp_enqueue_script(Main::ACCORDION_SCRIPT_HANDLE);
        }
    }
}
