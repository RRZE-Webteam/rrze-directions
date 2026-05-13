<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Entry point: wires editor assets and localizes FAUdir workplace data for the block UI.
 */
final class Main
{
    public function __construct()
    {
        add_action('enqueue_block_editor_assets', [$this, 'enqueueEditor']);
        RestResolveCoordinates::register();
        RestOpenRouteDirections::register();
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
                'restOpenRouteDirectionsPath' => '/rrze-direction/v1/openroute-directions',
                'editorStrings'               => [
                    'pleaseSelectPerson'         => __('Select a person from FAUdir first.', 'rrze-direction'),
                    'addressLabel'               => __('Address', 'rrze-direction'),
                    'roomLabel'                  => __('Room: %s', 'rrze-direction'),
                    'floorLabel'                 => __('Floor: %s', 'rrze-direction'),
                    'selectWorkplace'            => __('Office / workplace', 'rrze-direction'),
                    'selectPerson'               => __('FAUdir person entry', 'rrze-direction'),
                    'selectPersonWorkplace'      => __('Select person and workplace.', 'rrze-direction'),
                    'mapSection'                 => __('Directions map', 'rrze-direction'),
                    'mapUrl'                     => __('Map URL (FAU Campus Map preset)', 'rrze-direction'),
                    'mapUrlHelp'                 => __('Taken from RRZE-FAUdir (campus map) but can be edited.', 'rrze-direction'),
                    'mapCoordinates'             => __('Coordinates', 'rrze-direction'),
                    'googleMaps'                 => __('Google Maps', 'rrze-direction'),
                    'appleMaps'                  => __('Apple Maps', 'rrze-direction'),
                    'mapImageLabel'              => __('Optional map illustration', 'rrze-direction'),
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
                    'coordinatesMissing'         => __('No coordinates detected in API data.', 'rrze-direction'),
                    'noneOption'                 => __('— Choose —', 'rrze-direction'),
                ],
            ], JSON_HEX_TAG | JSON_HEX_AMP),
            'before'
        );
    }
}
