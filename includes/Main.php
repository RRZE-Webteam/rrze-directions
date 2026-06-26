<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Entry point: wires editor assets and localizes FAUdir workplace data for the block UI.
 */
final class Main
{
    public const ACCORDION_SCRIPT_HANDLE = 'rrze-direction-accordion';

    public const ROUTE_MAP_SCRIPT_HANDLE = 'rrze-direction-route-map';

    public const ROUTE_MAP_STYLE_HANDLE = 'rrze-direction-route-map';

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
        if (!wp_script_is('rrze-direction-view-script', 'registered')) {
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
     * Expose `window.rrze_direction` (persons + translated editor labels) before the script runs.
     */
    public function enqueueEditor(): void
    {
        $handle = generate_block_asset_handle('rrze/direction', 'editorScript');

        if (!wp_script_is($handle, 'registered')) {
            return;
        }

        $payload = FaudirWorkplaceResolver::personsWithWorkplaces();

        wp_add_inline_script(
            $handle,
            'window.rrze_direction = ' . wp_json_encode([
                'persons'                     => $payload,
                'restResolveCoordinatesPath'  => '/rrze-direction/v1/resolve-coordinates',
                'restResolveIframeSrcPath'    => '/rrze-direction/v1/resolve-iframe-src',
                'restOpenRouteDirectionsPath' => '/rrze-direction/v1/openroute-directions',
                'editorStrings'               => [
                    'pleaseSelectPerson'         => __('Select a person from FAUdir first.', 'rrze-direction'),
                    'addressLabel'               => __('Address', 'rrze-direction'),
                    'roomLabel'                  => __('Room: %s', 'rrze-direction'),
                    'floorLabel'                 => __('Floor: %s', 'rrze-direction'),
                    'selectWorkplace'            => __('Office / workplace', 'rrze-direction'),
                    'selectPersonPanel'          => __('FAUdir', 'rrze-direction'),
                    'selectPerson'               => __('Person', 'rrze-direction'),
                    'selectPersonWorkplace'      => __('Select person and workplace.', 'rrze-direction'),
                    'mapSection'                 => __('Directions map', 'rrze-direction'),
                    'mapUrl'                     => __('Link to', 'rrze-direction'),
                    'googleMaps'                 => __('Google Maps', 'rrze-direction'),
                    'appleMaps'                  => __('Apple Maps', 'rrze-direction'),
                    'mapImageLabel'              => __('Illustration', 'rrze-direction'),
                    'replaceIllustration'        => __('Replace illustration', 'rrze-direction'),
                    'removeIllustration'         => __('Remove illustration', 'rrze-direction'),
                    'mapServiceTitle'            => __('FAU map service', 'rrze-direction'),
                    'mapUnavailable'             => __('No map parameters available (add FAUdir data or a Map URL).', 'rrze-direction'),
                    'directionBike'              => __('Walking / Cycling', 'rrze-direction'),
                    'directionCar'               => __('By car', 'rrze-direction'),
                    'directionTransit'           => __('Bus / train', 'rrze-direction'),
                    'directionBikePlaceholder'   => __('Directions by foot / bike.', 'rrze-direction'),
                    'directionCarPlaceholder'    => __('Directions by car.', 'rrze-direction'),
                    'directionTransitPlaceholder'=> __('Public transport.', 'rrze-direction'),
                    'directionsSettings'           => __('Arrival directions', 'rrze-direction'),
                    'showDirectionBike'            => __('Show walking / cycling', 'rrze-direction'),
                    'showDirectionCar'             => __('Show by car', 'rrze-direction'),
                    'showDirectionTransit'         => __('Show bus / train', 'rrze-direction'),
                    'directionsLayout'             => __('Layout', 'rrze-direction'),
                    'directionsLayoutAccordion'    => __('Accordion', 'rrze-direction'),
                    'directionsLayoutColumns'      => __('Columns', 'rrze-direction'),
                    'directionsLayoutTabs'         => __('Tabs', 'rrze-direction'),
					'routeMapTitle'                => __('Route map', 'rrze-direction'),
					'routeMapPreview'              => __('Interactive route map with numbered steps is shown on the published page.', 'rrze-direction'),
					'routeMapHint'                 => __('Click a numbered step in the directions list to highlight it on the map.', 'rrze-direction'),
					'directionsLoading'            => __('Loading directions…', 'rrze-direction'),
					'mapLoading'                   => __('Loading map…', 'rrze-direction'),
                    'coordinatesMissing'         => __('No coordinates detected in API data.', 'rrze-direction'),
                    'noneOption'                 => __('— Choose —', 'rrze-direction'),
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
