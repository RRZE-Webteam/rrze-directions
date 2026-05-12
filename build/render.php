<?php

declare(strict_types=1);

defined('ABSPATH') || exit;

$attributes = is_array($attributes ?? null) ? $attributes : [];

$organizationName = (string) ($attributes['organizationName'] ?? '');
$addressRoom      = (string) ($attributes['addressRoom'] ?? '');
$addressFloor     = (string) ($attributes['addressFloor'] ?? '');
$addressStreet    = (string) ($attributes['addressStreet'] ?? '');
$addressZip       = (string) ($attributes['addressZip'] ?? '');
$addressCity      = (string) ($attributes['addressCity'] ?? '');
$addressFormatted = (string) ($attributes['addressFormatted'] ?? '');

$showMap    = !empty($attributes['showMap']);
$mapUrl     = trim((string) ($attributes['mapUrl'] ?? ''));
$mapImageId = isset($attributes['mapImageId']) ? (int) $attributes['mapImageId'] : 0;

$directionBike    = (string) ($attributes['directionBike'] ?? '');
$directionCar     = (string) ($attributes['directionCar'] ?? '');
$directionTransit = (string) ($attributes['directionTransit'] ?? '');

$karteIframeSrc = class_exists(\RRZE\Direction\FauMapIframe::class)
    ? \RRZE\Direction\FauMapIframe::resolveIframeSrc($attributes)
    : '';

[$mapLatitude, $mapLongitude] = class_exists(\RRZE\Direction\MapLinks::class)
    ? \RRZE\Direction\MapLinks::coordinatesFromAttributes($attributes)
    : [null, null];

$streetLine = class_exists(\RRZE\Direction\AddressPresentation::class)
    ? \RRZE\Direction\AddressPresentation::streetLine($addressStreet, $addressZip, $addressCity)
    : '';

$showFormattedAddress = class_exists(\RRZE\Direction\AddressPresentation::class)
    ? \RRZE\Direction\AddressPresentation::shouldShowFormattedAddress($addressFormatted, $streetLine)
    : trim($addressFormatted) !== '';

$normalizeMapHref = static function (string $url): string {
    $url = trim($url);
    if ($url === '') {
        return '';
    }
    $u = esc_url($url, ['http', 'https']);

    return is_string($u) ? $u : '';
};

$mapLinkOnly   = $normalizeMapHref($mapUrl);
$showExtraLink = $mapLinkOnly !== ''
    && (
        $karteIframeSrc === ''
        || rtrim(strtolower($mapLinkOnly), '/') !== rtrim(strtolower($karteIframeSrc), '/')
    );

$class = trim('wp-block-rrze-direction rrze-direction');
?>
<section class="<?php echo esc_attr($class); ?>">
    <div class="rrze-direction__body">
        <h2 class="rrze-direction__title"><?php echo esc_html__('Directions', 'rrze-direction'); ?></h2>

        <address class="rrze-direction__address">
            <?php echo esc_html__('Address', 'rrze-direction'); ?><br>
            <?php if ($organizationName !== '') : ?>
                <span class="rrze-direction__org"><?php echo esc_html($organizationName); ?></span><br>
            <?php endif; ?>

            <?php if ($addressRoom !== '') : ?>
                <span class="rrze-direction__room">
                    <?php
                    echo esc_html(
                        sprintf(
                            /* translators: %s: room number */
                            __('Room: %s', 'rrze-direction'),
                            $addressRoom
                        )
                    );
                    ?>
                </span><br>
            <?php endif; ?>

            <?php if ($addressFloor !== '') : ?>
                <span class="rrze-direction__floor">
                    <?php
                    echo esc_html(
                        sprintf(
                            /* translators: %s: floor */
                            __('Floor: %s', 'rrze-direction'),
                            $addressFloor
                        )
                    );
                    ?>
                </span><br>
            <?php endif; ?>

            <?php if ($streetLine !== '') : ?>
                <span class="rrze-direction__street"><?php echo esc_html($streetLine); ?></span><br>
            <?php elseif ($showFormattedAddress) : ?>
                <span class="rrze-direction__street"><?php echo esc_html($addressFormatted); ?></span><br>
            <?php elseif ('' === $organizationName) : ?>
                <?php echo esc_html__('Address data unavailable.', 'rrze-direction'); ?><br>
            <?php endif; ?>

            <?php if ($showFormattedAddress && $streetLine !== '') : ?>
                <span class="rrze-direction__meta"><?php echo esc_html($addressFormatted); ?></span>
            <?php endif; ?>
        </address>

        <?php if (null !== $mapLatitude && null !== $mapLongitude) : ?>
            <p class="rrze-direction__coordinates">
                <?php echo esc_html__('Coordinates', 'rrze-direction'); ?>:
                <a href="<?php echo esc_url(\RRZE\Direction\MapLinks::googleMapsUrl($mapLatitude, $mapLongitude), ['https']); ?>">
                    <?php echo esc_html__('Google Maps', 'rrze-direction'); ?>
                </a>
                <span class="rrze-direction__coordinates-sep" aria-hidden="true">·</span>
                <a href="<?php echo esc_url(\RRZE\Direction\MapLinks::appleMapsUrl($mapLatitude, $mapLongitude), ['https']); ?>">
                    <?php echo esc_html__('Apple Maps', 'rrze-direction'); ?>
                </a>
            </p>
        <?php endif; ?>

        <?php if ($showMap) : ?>
            <?php if ($mapImageId > 0) : ?>
                <figure class="rrze-direction__map-image">
                    <?php
                    echo wp_get_attachment_image(
                        $mapImageId,
                        'large',
                        false,
                        [
                            'class'    => 'rrze-direction__map-img',
                            'decoding' => 'async',
                            'loading'  => 'lazy',
                        ]
                    );
                    ?>
                </figure>
            <?php endif; ?>

            <div class="rrze-direction__map">
                <h3 class="rrze-direction__map-title"><?php echo esc_html__('Arrival map', 'rrze-direction'); ?></h3>

                <?php if ($karteIframeSrc !== '') : ?>
                    <div class="rrze-direction__map-frame">
                        <iframe
                            title="<?php echo esc_attr__('FAU map service', 'rrze-direction'); ?>"
                            src="<?php echo esc_url($karteIframeSrc, ['https']); ?>"
                            class="rrze-direction__iframe"
                            loading="lazy"
                            referrerpolicy="no-referrer-when-downgrade"></iframe>
                    </div>
                    <?php if ($showExtraLink) : ?>
                        <p class="rrze-direction__map-extra">
                            <a href="<?php echo $mapLinkOnly; ?>"><?php echo esc_html__('Additional map link', 'rrze-direction'); ?></a>
                        </p>
                    <?php endif; ?>
                <?php elseif ($mapLinkOnly !== '') : ?>
                    <p class="rrze-direction__map-link">
                        <a href="<?php echo $mapLinkOnly; ?>"><?php echo esc_html__('Open map link', 'rrze-direction'); ?></a>
                    </p>
                <?php else : ?>
                    <p class="rrze-direction__map-empty">
                        <?php echo esc_html__('No map parameters available (add FAUdir data or a Map URL).', 'rrze-direction'); ?></p>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <?php if (trim(wp_strip_all_tags($directionBike)) !== '') : ?>
            <section class="rrze-direction__text">
                <h3><?php echo esc_html__('Walking / Cycling', 'rrze-direction'); ?></h3>
                <div class="rrze-direction__rte"><?php echo wp_kses_post($directionBike); ?></div>
            </section>
        <?php endif; ?>

        <?php if (trim(wp_strip_all_tags($directionCar)) !== '') : ?>
            <section class="rrze-direction__text">
                <h3><?php echo esc_html__('By car', 'rrze-direction'); ?></h3>
                <div class="rrze-direction__rte"><?php echo wp_kses_post($directionCar); ?></div>
            </section>
        <?php endif; ?>

        <?php if (trim(wp_strip_all_tags($directionTransit)) !== '') : ?>
            <section class="rrze-direction__text">
                <h3><?php echo esc_html__('Bus / train', 'rrze-direction'); ?></h3>
                <div class="rrze-direction__rte"><?php echo wp_kses_post($directionTransit); ?></div>
            </section>
        <?php endif; ?>

    </div>
</section>
