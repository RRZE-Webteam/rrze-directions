<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Renders directions sections (foot, car, transit) as pills, accordion, tabs, columns, or dropdown.
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
                'enabled' => self::isTypeEnabled($attributes, 'showDirectionsBike'),
                'content' => (string) ($attributes['directionsBike'] ?? ''),
                'route'   => (string) ($attributes['directionsBikeRoute'] ?? ''),
                'title'   => __('Walking / Cycling', 'rrze-directions'),
            ],
            [
                'key'     => 'car',
                'enabled' => self::isTypeEnabled($attributes, 'showDirectionsCar'),
                'content' => (string) ($attributes['directionsCar'] ?? ''),
                'route'   => (string) ($attributes['directionsCarRoute'] ?? ''),
                'title'   => __('By car', 'rrze-directions'),
            ],
            [
                'key'     => 'transit',
                'enabled' => self::isTypeEnabled($attributes, 'showDirectionsTransit'),
                'content' => (string) ($attributes['directionsTransit'] ?? ''),
                'route'   => (string) ($attributes['directionsTransitRoute'] ?? ''),
                'title'   => __('Bus / train', 'rrze-directions'),
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

        ModeIcons::enqueueDashicons();

        $layout = self::normalizeLayout((string) ($attributes['directionsLayout'] ?? 'pills'));

        if ($layout === 'pills') {
            return self::renderPills($sections);
        }

        if ($layout === 'columns') {
            return self::renderColumns($sections);
        }

        if ($layout === 'tabs') {
            return self::renderTabs($sections);
        }

        if ($layout === 'dropdown') {
            return self::renderDropdown($sections);
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
            'accordion' => 'accordion',
            'columns'   => 'columns',
            'tabs'      => 'tabs',
            'dropdown'  => 'dropdown',
            default     => 'pills',
        };
    }

    /**
     * @param list<array{key: string, title: string, html: string, route: string}> $sections
     */
    private static function renderPills(array $sections): string
    {
        if (count($sections) === 1) {
            return '<div class="rrze-directions__directions rrze-directions__directions--mode-pills"'
                . ' role="region"'
                . ' aria-label="' . esc_attr__('Directions', 'rrze-directions') . '">'
                . self::renderSectionBody($sections[0])
                . '</div>';
        }

        $groupId = wp_unique_id('rrze-directions-mode-');
        $pills   = '';
        $panels  = '';

        foreach ($sections as $index => $section) {
            $active  = $index === 0;
            $pillId  = $groupId . '-pill-' . $section['key'];
            $panelId = $groupId . '-panel-' . $section['key'];

            $pills .= '<button'
                . ' type="button"'
                . ' class="rrze-directions__mode-pill' . ($active ? ' is-active' : '') . '"'
                . ' role="tab"'
                . ' id="' . esc_attr($pillId) . '"'
                . ' aria-selected="' . ($active ? 'true' : 'false') . '"'
                . ' aria-controls="' . esc_attr($panelId) . '"'
                . ' aria-label="' . esc_attr($section['title']) . '"'
                . ' data-mode-key="' . esc_attr($section['key']) . '"'
                . ($active ? '' : ' tabindex="-1"')
                . '>';
            $pills .= ModeIcons::modeIconHtml($section['key']);
            $pills .= '</button>';

            $panels .= '<div'
                . ' class="rrze-directions__mode-variant' . ($active ? ' is-active' : '') . '"'
                . ' id="' . esc_attr($panelId) . '"'
                . ' role="tabpanel"'
                . ' aria-labelledby="' . esc_attr($pillId) . '"'
                . ' data-mode-key="' . esc_attr($section['key']) . '"'
                . ($active ? '' : ' hidden')
                . '>';
            $panels .= '<h3 class="screen-reader-text">' . esc_html($section['title']) . '</h3>';
            $panels .= self::renderSectionBody($section);
            $panels .= '</div>';
        }

        return '<div class="rrze-directions__directions rrze-directions__directions--mode-pills"'
            . ' role="region"'
            . ' aria-label="' . esc_attr__('Directions', 'rrze-directions') . '">'
            . '<div class="rrze-directions__mode-switcher" data-mode-switcher="1">'
            . '<div class="rrze-directions__mode-pills" role="tablist" aria-label="'
            . esc_attr__('Mode of transport', 'rrze-directions')
            . '">'
            . $pills
            . '</div>'
            . '<div class="rrze-directions__mode-panels">'
            . $panels
            . '</div>'
            . '</div>'
            . '</div>';
    }

    /**
     * @param list<array{key: string, title: string, html: string, route: string}> $sections
     */
    private static function renderAccordion(array $sections): string
    {
        self::enqueueAccordionAssets();

        $items = '';

        foreach ($sections as $index => $section) {
            $panelId   = wp_unique_id('rrze-directions-' . $section['key'] . '-');
            $regionId  = $panelId . '-section';
            $isOpen    = $index === 0;
            $toggleCls = 'rrze-directions__accordion-toggle' . ($isOpen ? ' active' : '');
            $bodyCls   = 'rrze-directions__accordion-panel' . ($isOpen ? ' open' : '');

            $items .= '<div class="rrze-directions__accordion-item">';
            $items .= '<div class="rrze-directions__accordion-group">';
            $items .= '<h3 class="rrze-directions__accordion-heading">';
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
            $items .= '<div class="rrze-directions__accordion-inner clearfix">';
            $items .= self::renderSectionBody($section);
            $items .= '</div></div></div></div>';
        }

        return '<div class="rrze-directions__directions rrze-directions__accordions"'
            . ' role="region"'
            . ' aria-label="' . esc_attr__('Directions', 'rrze-directions') . '">'
            . '<div class="rrze-directions__accordion">'
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
            $items .= '<section class="rrze-directions__text rrze-directions__text--column">'
                . '<h3>' . esc_html($section['title']) . '</h3>'
                . self::renderSectionBody($section)
                . '</section>';
        }

        return '<div class="rrze-directions__directions rrze-directions__directions-grid'
            . ' rrze-directions__directions-grid--cols-' . esc_attr((string) $cols)
            . '" role="region"'
            . ' aria-label="' . esc_attr__('Directions', 'rrze-directions') . '">'
            . $items
            . '</div>';
    }

    /**
     * @param list<array{key: string, title: string, html: string, route: string}> $sections
     */
    private static function renderTabs(array $sections): string
    {
        self::enqueueTabsAssets();

        $groupId = wp_unique_id('rrze-directions-tabs-');
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

        return '<div class="rrze-directions__directions"'
            . ' role="region"'
            . ' aria-label="' . esc_attr__('Directions', 'rrze-directions') . '">'
            . '<div class="rrze-elements-tabs primary" id="tabs-' . esc_attr($groupId) . '"' . $externalTabs . '>'
            . '<div role="tablist" class="manual">'
            . $nav
            . '</div>'
            . $panels
            . '</div>'
            . '</div>';
    }

    /**
     * @param list<array{key: string, title: string, html: string, route: string}> $sections
     */
    private static function renderDropdown(array $sections): string
    {
        $groupId  = wp_unique_id('rrze-directions-mode-');
        $selectId = $groupId . '-select';
        $options  = '';
        $panels   = '';

        foreach ($sections as $index => $section) {
            $active  = $index === 0;
            $panelId = $groupId . '-panel-' . $section['key'];

            $options .= '<option value="' . esc_attr($section['key']) . '"' . ($active ? ' selected' : '') . '>';
            $options .= esc_html($section['title']);
            $options .= '</option>';

            $panels .= '<div'
                . ' class="rrze-directions__mode-panel' . ($active ? ' is-active' : '') . '"'
                . ' id="' . esc_attr($panelId) . '"'
                . ' data-mode="' . esc_attr($section['key']) . '"'
                . ' role="region"'
                . ' aria-label="' . esc_attr($section['title']) . '"'
                . ($active ? '' : ' hidden')
                . '>';
            $panels .= '<h3 class="screen-reader-text">' . esc_html($section['title']) . '</h3>';
            $panels .= self::renderSectionBody($section);
            $panels .= '</div>';
        }

        return '<div class="rrze-directions__directions rrze-directions__directions--dropdown"'
            . ' role="region"'
            . ' aria-label="' . esc_attr__('Directions', 'rrze-directions') . '">'
            . '<div class="rrze-directions__mode-dropdown">'
            . '<label class="rrze-directions__mode-label" for="' . esc_attr($selectId) . '">'
            . esc_html__('Mode of transport', 'rrze-directions')
            . '</label>'
            . '<select class="rrze-directions__mode-select" id="' . esc_attr($selectId) . '" data-mode-select="1">'
            . $options
            . '</select>'
            . '</div>'
            . '<div class="rrze-directions__mode-panels">'
            . $panels
            . '</div>'
            . '</div>';
    }

    /**
     * @param array{key: string, title: string, html: string, route: string} $section
     */
    private static function renderSectionBody(array $section): string
    {
        $variants = RouteMapPresentation::parseVariants($section['route']);

        if ($variants !== []) {
            return self::renderStartSwitcher($variants, $section['html']);
        }

        $html = RouteMapPresentation::render($section['route']);
        $html .= '<div class="rrze-directions__rte">' . wp_kses_post($section['html']) . '</div>';

        return $html;
    }

    /**
     * @param list<array{startKey: string, startLabel: string, route: array<string, mixed>}> $variants
     */
    private static function renderStartSwitcher(array $variants, string $sectionHtml): string
    {
        if (count($variants) === 1) {
            $variant   = $variants[0];
            $routeJson = wp_json_encode($variant['route']);
            $htmlParts = self::splitRouteVariantHtml($sectionHtml);
            $part      = $htmlParts[0] ?? trim($sectionHtml);
            $output    = '';

            if (is_string($routeJson) && $routeJson !== '') {
                $output .= RouteMapPresentation::render($routeJson);
            }

            if ($part !== '') {
                $output .= '<div class="rrze-directions__rte">' . wp_kses_post($part) . '</div>';
            }

            return $output;
        }

        $htmlParts = self::splitRouteVariantHtml($sectionHtml);
        $groupId   = wp_unique_id('rrze-directions-start-');
        $pills     = '';
        $panels    = '';

        foreach ($variants as $index => $variant) {
            $startKey = $variant['startKey'] !== '' ? $variant['startKey'] : 'variant-' . $index;
            $label    = $variant['startLabel'] !== ''
                ? $variant['startLabel']
                : sprintf(
                    /* translators: %d: variant number */
                    __('Route %d', 'rrze-directions'),
                    $index + 1
                );
            $active  = $index === 0;
            $pillId  = $groupId . '-pill-' . $startKey;
            $panelId = $groupId . '-panel-' . $startKey;

            $pills .= '<button'
                . ' type="button"'
                . ' class="rrze-directions__start-pill' . ($active ? ' is-active' : '') . '"'
                . ' role="tab"'
                . ' id="' . esc_attr($pillId) . '"'
                . ' aria-selected="' . ($active ? 'true' : 'false') . '"'
                . ' aria-controls="' . esc_attr($panelId) . '"'
                . ' data-start-key="' . esc_attr($startKey) . '"'
                . ($active ? '' : ' tabindex="-1"')
                . '>';
            $pills .= ModeIcons::startIconHtml($startKey);
            $pills .= '<span class="rrze-directions__start-pill-label">' . esc_html($label) . '</span>';
            $pills .= '</button>';

            $routeJson      = wp_json_encode($variant['route']);
            $panelContent   = '';
            $part           = $htmlParts[$index] ?? '';

            if (is_string($routeJson) && $routeJson !== '') {
                $panelContent .= RouteMapPresentation::render($routeJson);
            }

            if ($part !== '') {
                $panelContent .= '<div class="rrze-directions__rte">' . wp_kses_post($part) . '</div>';
            }

            $panels .= '<div'
                . ' class="rrze-directions__route-variant' . ($active ? ' is-active' : '') . '"'
                . ' id="' . esc_attr($panelId) . '"'
                . ' role="tabpanel"'
                . ' aria-labelledby="' . esc_attr($pillId) . '"'
                . ' data-start-key="' . esc_attr($startKey) . '"'
                . ($active ? '' : ' hidden')
                . '>';
            $panels .= $panelContent;
            $panels .= '</div>';
        }

        return '<div class="rrze-directions__start-switcher" data-start-switcher="1">'
            . '<div class="rrze-directions__start-pills" role="tablist" aria-label="'
            . esc_attr__('Starting point', 'rrze-directions')
            . '">'
            . $pills
            . '</div>'
            . '<div class="rrze-directions__start-panels">'
            . $panels
            . '</div>'
            . '</div>';
    }

    /**
     * @return list<string>
     */
    private static function splitRouteVariantHtml(string $html): array
    {
        if (!str_contains($html, 'rrze-directions__route-variant')) {
            $trimmed = trim($html);

            return $trimmed === '' ? [] : [$trimmed];
        }

        if (preg_match_all(
            '/<div class="rrze-directions__route-variant">(.*?)<\/div>/s',
            $html,
            $matches
        ) && is_array($matches[1]) && $matches[1] !== []) {
            $parts = array_map(static fn(string $part): string => trim($part), $matches[1]);

            if ($parts !== []) {
                return $parts;
            }
        }

        $previous = libxml_use_internal_errors(true);
        $document = new \DOMDocument();
        $wrapped  = '<div id="rrze-directions-root">' . $html . '</div>';
        $parts    = [];

        if ($document->loadHTML(
            '<?xml encoding="utf-8" ?>' . $wrapped,
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        )) {
            $xpath = new \DOMXPath($document);
            $nodes = $xpath->query(
                "//*[contains(concat(' ', normalize-space(@class), ' '), ' rrze-directions__route-variant ')]"
            );

            if ($nodes instanceof \DOMNodeList) {
                foreach ($nodes as $node) {
                    $inner = '';
                    foreach ($node->childNodes as $child) {
                        $inner .= $document->saveHTML($child);
                    }

                    $parts[] = trim($inner);
                }
            }
        }

        libxml_use_internal_errors($previous);

        if ($parts !== []) {
            return $parts;
        }

        $trimmed = trim($html);

        return $trimmed === '' ? [] : [$trimmed];
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
