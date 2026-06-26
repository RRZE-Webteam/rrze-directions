<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Renders direction sections (foot, car, transit) as accordion, tabs, or column grid.
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

        if ($layout === 'tabs') {
            return self::renderTabs($sections);
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
        return match ($layout) {
            'columns' => 'columns',
            'tabs'    => 'tabs',
            default   => 'accordion',
        };
    }

    /**
     * @param list<array{key: string, title: string, html: string, route: string}> $sections
     */
    private static function renderAccordion(array $sections): string
    {
        self::enqueueAccordionAssets();

        $items = '';

        foreach ($sections as $index => $section) {
            $panelId   = wp_unique_id('rrze-direction-' . $section['key'] . '-');
            $regionId  = $panelId . '-section';
            $isOpen    = $index === 0;
            $toggleCls = 'rrze-direction__accordion-toggle' . ($isOpen ? ' active' : '');
            $bodyCls   = 'rrze-direction__accordion-panel' . ($isOpen ? ' open' : '');

            $items .= '<div class="rrze-direction__accordion-item">';
            $items .= '<div class="rrze-direction__accordion-group">';
            $items .= '<h3 class="rrze-direction__accordion-heading">';
            $items .= '<button'
                . ' class="' . esc_attr($toggleCls) . '"'
                . ' type="button"'
                . ' aria-expanded="' . ($isOpen ? 'true' : 'false') . '"'
                . ' aria-controls="' . esc_attr($regionId) . '"'
                . ' id="' . esc_attr($panelId) . '"'
                . '>';
            $items .= esc_html($section['title']);
            $items .= '</button>';
            $items .= '</h3>';
            $items .= '<div'
                . ' id="' . esc_attr($regionId) . '"'
                . ' class="' . esc_attr($bodyCls) . '"'
                . ' aria-labelledby="' . esc_attr($panelId) . '"'
                . ' role="region"'
                . '>';
            $items .= '<div class="rrze-direction__accordion-inner clearfix">';
            $items .= self::renderSectionBody($section);
            $items .= '</div></div></div></div>';
        }

        return '<div class="rrze-direction__directions rrze-direction__accordions"'
            . ' role="region"'
            . ' aria-label="' . esc_attr__('Directions', 'rrze-direction') . '">'
            . '<div class="rrze-direction__accordion">'
            . $items
            . '</div></div>';
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
     * @param list<array{key: string, title: string, html: string, route: string}> $sections
     */
    private static function renderTabs(array $sections): string
    {
        self::enqueueTabsAssets();

        $groupId = wp_unique_id('rrze-direction-tabs-');
        $nav     = '';
        $panels  = '';

        foreach ($sections as $index => $section) {
            $tabId   = $groupId . '-' . $section['key'];
            $panelId = 'tab-' . $groupId . '_tabpanel_tab-label-' . $section['key'];
            $active  = $index === 0;

            $nav .= '<button'
                . ' id="' . esc_attr($tabId) . '"'
                . ' type="button"'
                . ' role="tab"'
                . ' aria-selected="' . ($active ? 'true' : 'false') . '"'
                . ' aria-controls="' . esc_attr($panelId) . '"'
                . ($active ? '' : ' tabindex="-1"')
                . '>';
            $nav .= '<span class="focus" tabindex="-1">' . esc_html($section['title']) . '</span>';
            $nav .= '</button>';

            $panels .= '<div'
                . ' id="' . esc_attr($panelId) . '"'
                . ' role="tabpanel"'
                . ' aria-labelledby="' . esc_attr($tabId) . '"'
                . ($active ? '' : ' class="is-hidden"')
                . '>';
            $panels .= self::renderSectionBody($section);
            $panels .= '</div>';
        }

        $externalTabs = '';
        if (wp_script_is('rrze-tabs', 'registered')) {
            $externalTabs = ' data-external-tabs-script="1"';
        }

        return '<div class="rrze-direction__directions"'
            . ' role="region"'
            . ' aria-label="' . esc_attr__('Directions', 'rrze-direction') . '">'
            . '<div class="rrze-elements-tabs primary" id="tabs-' . esc_attr($groupId) . '"' . $externalTabs . '>'
            . '<div role="tablist" class="manual">'
            . $nav
            . '</div>'
            . $panels
            . '</div>'
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
        // view.js is loaded via block.json viewScript; keep handle for older WP fallbacks.
        if (wp_script_is(Main::ACCORDION_SCRIPT_HANDLE, 'registered')) {
            wp_enqueue_script(Main::ACCORDION_SCRIPT_HANDLE);
        }
    }

    private static function enqueueTabsAssets(): void
    {
        if (wp_script_is('rrze-tabs', 'registered')) {
            wp_enqueue_script('rrze-tabs');
        }
    }
}
