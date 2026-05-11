<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

final class Main
{
    public function __construct()
    {
        add_action('enqueue_block_editor_assets', [$this, 'enqueueEditor']);
    }

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
                'persons'       => $payload,
                'editorStrings' => [
                    'pleaseSelectPerson'    => __('Select a person from FAUdir first.', 'rrze-direction'),
                    'addressFromFaudir'     => __('Address (from FAUdir)', 'rrze-direction'),
                    'selectWorkplace'       => __('Office / workplace', 'rrze-direction'),
                    'selectPerson'          => __('FAUdir person entry', 'rrze-direction'),
                    'mapSection'            => __('Directions map', 'rrze-direction'),
                    'showMap'               => __('Show arrival map section', 'rrze-direction'),
                    'mapUrl'                => __('Map URL (FAU Campus Map preset)', 'rrze-direction'),
                    'mapCoordinates'        => __('Coordinates', 'rrze-direction'),
                    'mapImageLabel'         => __('Optional map illustration', 'rrze-direction'),
                    'directionBike'         => __('Walking / Cycling', 'rrze-direction'),
                    'directionCar'          => __('By car', 'rrze-direction'),
                    'directionTransit'      => __('Bus / train', 'rrze-direction'),
                    'coordinatesMissing'    => __('No coordinates detected in API data.', 'rrze-direction'),
                    'noneOption'            => __('— Choose —', 'rrze-direction'),
                ],
            ], JSON_HEX_TAG | JSON_HEX_AMP),
            'before'
        );
    }
}
