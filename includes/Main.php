<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Entry point: wires editor assets and localizes FAUdir workplace data for the block UI.
 */
final class Main
{
    public const ACCORDION_SCRIPT_HANDLE = 'rrze-directions-accordion';

    public const ROUTE_MAP_SCRIPT_HANDLE = 'rrze-directions-route-map';

    public const ROUTE_MAP_STYLE_HANDLE = 'rrze-directions-route-map';

    public function __construct()
    {
        add_action('init', [$this, 'registerAssets']);
        add_action('enqueue_block_editor_assets', [$this, 'enqueueEditor']);
        add_action('save_post', [$this, 'invalidateFaudirCacheOnPersonSave'], 10, 3);
        RestResolveCoordinates::register();
        RestResolveIframeSrc::register();
        RestOpenRouteDirections::register();
    }

    public function registerAssets(): void
    {
        $accordionPath = plugin()->getPath() . 'build/view.js';
        if (is_readable($accordionPath)) {
            $assetFile = plugin()->getPath() . 'build/view.asset.php';
            $asset     = is_readable($assetFile) ? require $assetFile : [];
            $version   = is_array($asset) ? (string) ($asset['version'] ?? '') : '';

            if ($version === '') {
                $version = (string) filemtime($accordionPath);
            }

            wp_register_script(
                self::ACCORDION_SCRIPT_HANDLE,
                plugins_url('build/view.js', plugin()->getBasename()),
                ['jquery'],
                $version,
                true
            );
        }

        $routeMapPath = plugin()->getPath() . 'build/view-route-map.js';
        if (!is_readable($routeMapPath)) {
            return;
        }

        $assetFile = plugin()->getPath() . 'build/view-route-map.asset.php';
        $asset     = is_readable($assetFile) ? require $assetFile : [];
        $routeVersion = is_array($asset) ? (string) ($asset['version'] ?? '') : '';

        if ($routeVersion === '') {
            $routeVersion = (string) filemtime($routeMapPath);
        }

        // Fallback when block viewScript/viewStyle handles are unavailable (older WP).
        if (!wp_script_is('rrze-directions-view-script', 'registered')) {
            $routeStylePath = plugin()->getPath() . 'build/view-route-map.css';
            if (is_readable($routeStylePath)) {
                wp_register_style(
                    self::ROUTE_MAP_STYLE_HANDLE,
                    plugins_url('build/view-route-map.css', plugin()->getBasename()),
                    [],
                    $routeVersion
                );
            }

            wp_register_script(
                self::ROUTE_MAP_SCRIPT_HANDLE,
                plugins_url('build/view-route-map.js', plugin()->getBasename()),
                [],
                $routeVersion,
                true
            );
        }
    }

    /**
     * Expose `window.rrze_directions` (persons + translated editor labels) before the script runs.
     */
    public function enqueueEditor(): void
    {
        $handle = generate_block_asset_handle('rrze/directions', 'editorScript');

        if (!wp_script_is($handle, 'registered')) {
            return;
        }

        $payload = FaudirWorkplaceResolver::personsWithWorkplaces();

        wp_add_inline_script(
            $handle,
            'window.rrze_directions = ' . wp_json_encode([
                'persons'                     => $payload,
                'restResolveCoordinatesPath'  => '/rrze-directions/v1/resolve-coordinates',
                'restResolveIframeSrcPath'    => '/rrze-directions/v1/resolve-iframe-src',
                'restOpenRouteDirectionsPath' => '/rrze-directions/v1/openroute-directions',
                'editorStrings'               => [
                    'pleaseSelectPerson'         => __('Select a person from FAUdir first.', 'rrze-directions'),
                    'addressLabel'               => __('Address', 'rrze-directions'),
                    'roomLabel'                  => __('Room: %s', 'rrze-directions'),
                    'floorLabel'                 => __('Floor: %s', 'rrze-directions'),
                    'selectWorkplace'            => __('Office / workplace', 'rrze-directions'),
                    'selectPersonPanel'          => __('FAUdir', 'rrze-directions'),
                    'selectPerson'               => __('Person', 'rrze-directions'),
                    'selectPersonWorkplace'      => __('Select person and workplace.', 'rrze-directions'),
                    'mapSection'                 => __('Directions map', 'rrze-directions'),
                    'mapUrl'                     => __('Link to', 'rrze-directions'),
                    'googleMaps'                 => __('Google Maps', 'rrze-directions'),
                    'appleMaps'                  => __('Apple Maps', 'rrze-directions'),
                    'mapImageLabel'              => __('Illustration', 'rrze-directions'),
                    'replaceIllustration'        => __('Replace illustration', 'rrze-directions'),
                    'removeIllustration'         => __('Remove illustration', 'rrze-directions'),
                    'mapServiceTitle'            => __('FAU map service', 'rrze-directions'),
                    'mapUnavailable'             => __('No map parameters available (add FAUdir data or a Map URL).', 'rrze-directions'),
                    'directionsBike'              => __('Walking / Cycling', 'rrze-directions'),
                    'directionsCar'               => __('By car', 'rrze-directions'),
                    'directionsTransit'           => __('Bus / train', 'rrze-directions'),
                    'directionsBikePlaceholder'   => __('Directions by foot / bike.', 'rrze-directions'),
                    'directionsCarPlaceholder'    => __('Directions by car.', 'rrze-directions'),
                    'directionsTransitPlaceholder'=> __('Public transport.', 'rrze-directions'),
                    'directionsSettings'           => __('Arrival directions', 'rrze-directions'),
                    'showDirectionsBike'            => __('Show walking / cycling', 'rrze-directions'),
                    'showDirectionsCar'             => __('Show by car', 'rrze-directions'),
                    'showDirectionsTransit'         => __('Show bus / train', 'rrze-directions'),
                    'directionsLayout'             => __('Layout', 'rrze-directions'),
                    'directionsLayoutAccordion'    => __('Accordion', 'rrze-directions'),
                    'directionsLayoutColumns'      => __('Columns', 'rrze-directions'),
                    'directionsLayoutTabs'         => __('Tabs', 'rrze-directions'),
                    'directionsLayoutDropdown'     => __('Dropdown', 'rrze-directions'),
                    'modeOfTransport'              => __('Mode of transport', 'rrze-directions'),
                    'startingPoint'                => __('Starting point', 'rrze-directions'),
					'routeMapTitle'                => __('Route map', 'rrze-directions'),
					'routeMapPreview'              => __('Interactive route map with numbered steps is shown on the published page.', 'rrze-directions'),
					'routeMapHint'                 => __('Click a numbered step in the directions list to highlight it on the map.', 'rrze-directions'),
					'directionsLoading'            => __('Loading directions…', 'rrze-directions'),
					'mapLoading'                   => __('Loading map…', 'rrze-directions'),
                    'coordinatesMissing'         => __('No coordinates detected in API data.', 'rrze-directions'),
                    'noneOption'                 => __('— Choose —', 'rrze-directions'),
                ],
            ], JSON_HEX_TAG | JSON_HEX_AMP),
            'before'
        );
    }

    public function invalidateFaudirCacheOnPersonSave(int $postId, \WP_Post $post, bool $update): void
    {
        unset($update);

        if (wp_is_post_revision($postId) || wp_is_post_autosave($postId)) {
            return;
        }

        $ptype = 'custom_person';
        if (class_exists(\RRZE\FAUdir\Config::class)) {
            $config = new \RRZE\FAUdir\Config();
            $configured = (string) $config->get('person_post_type');
            if ($configured !== '') {
                $ptype = $configured;
            }
        }

        if ($post->post_type !== $ptype) {
            return;
        }

        ApiCache::flushGroup('faudir');
    }
}
