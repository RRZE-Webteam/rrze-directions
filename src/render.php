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
$mapUrl     = (string) ($attributes['mapUrl'] ?? '');
$mapLatRaw  = (string) ($attributes['mapLatitude'] ?? '');
$mapLonRaw  = (string) ($attributes['mapLongitude'] ?? '');
$mapImageId = isset($attributes['mapImageId']) ? (int) $attributes['mapImageId'] : 0;

$directionBike    = (string) ($attributes['directionBike'] ?? '');
$directionCar     = (string) ($attributes['directionCar'] ?? '');
$directionTransit = (string) ($attributes['directionTransit'] ?? '');

$openStreetMapIframe = static function (float $latitude, float $longitude): string {
    $delta  = 0.012;
    $bbox   = implode(
        ',',
        [
            $longitude - $delta,
            $latitude - $delta,
            $longitude + $delta,
            $latitude + $delta,
        ]
    );

    return sprintf(
        'https://www.openstreetmap.org/export/embed.html?bbox=%s&layer=mapnik&marker=%s',
        rawurlencode($bbox),
        rawurlencode(implode(',', [$latitude, $longitude]))
    );
};

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

            <?php if ($addressRoom !== '' || $addressFloor !== '') : ?>
                <span class="rrze-direction__room">
                    <?php echo esc_html(implode(' · ', array_filter([$addressRoom, $addressFloor]))); ?>
                </span><br>
            <?php endif; ?>

            <?php
            $line = array_filter(
                [$addressStreet, trim($addressZip . ' ' . $addressCity)],
                static fn(string $v): bool => $v !== ''
            );
            ?>
            <?php if ($line !== []) : ?>
                <span class="rrze-direction__street"><?php echo esc_html(implode(', ', $line)); ?></span><br>
            <?php elseif ('' === $organizationName && '' === $addressFormatted) : ?>
                <?php echo esc_html__('Address data unavailable.', 'rrze-direction'); ?><br>
            <?php endif; ?>

            <?php if ($addressFormatted !== '') : ?>
                <span class="rrze-direction__meta"><?php echo esc_html($addressFormatted); ?></span>
            <?php endif; ?>
        </address>

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

            <?php
            $latNormalized = str_replace(',', '.', $mapLatRaw);
            $lonNormalized = str_replace(',', '.', $mapLonRaw);

            $latFloat = $latNormalized !== '' && is_numeric($latNormalized) ? (float) $latNormalized : null;
            $lonFloat = $lonNormalized !== '' && is_numeric($lonNormalized) ? (float) $lonNormalized : null;

            $iframeSrc      = '';
            $canEmbedOpenSm = false;
            if (
                null !== $latFloat && null !== $lonFloat
                && is_finite($latFloat) && is_finite($lonFloat)
            ) {
                $iframeCandidate = $openStreetMapIframe($latFloat, $lonFloat);
                $pieces          = wp_parse_url($iframeCandidate);
                if (
                    isset($pieces['host'])
                    && (str_ends_with(strtolower((string) $pieces['host']), 'openstreetmap.org'))
                    && (str_starts_with((string) ($pieces['scheme'] ?? ''), 'http'))
                ) {
                    $iframeSrc      = esc_url($iframeCandidate, ['http', 'https']);
                    $canEmbedOpenSm = '' !== $iframeSrc;
                }
            }
            ?>

            <div class="rrze-direction__map">
                <h3 class="rrze-direction__map-title"><?php echo esc_html__('Arrival map', 'rrze-direction'); ?></h3>

                <?php if ($canEmbedOpenSm) : ?>
                    <div class="rrze-direction__map-frame">
                        <iframe
                            title="<?php echo esc_attr__('OpenStreetMap', 'rrze-direction'); ?>"
                            src="<?php echo $iframeSrc; ?>"
                            class="rrze-direction__iframe"
                            loading="lazy"
                            referrerpolicy="no-referrer-when-downgrade"></iframe>
                    </div>
                    <?php if ($mapUrl !== '') : ?>
                        <p class="rrze-direction__map-extra">
                            <a href="<?php echo esc_url($mapUrl); ?>"><?php echo esc_html__('Campus map (FAU)', 'rrze-direction'); ?></a>
                        </p>
                    <?php endif; ?>
                <?php elseif ($mapUrl !== '') : ?>
                    <p class="rrze-direction__map-link">
                        <a href="<?php echo esc_url($mapUrl); ?>"><?php echo esc_html__('Open map link', 'rrze-direction'); ?></a>
                    </p>
                <?php else : ?>
                    <p class="rrze-direction__map-empty">
                        <?php echo esc_html__('No map link or embedded coordinates.', 'rrze-direction'); ?></p>
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
