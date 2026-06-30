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

$mapUrl     = trim((string) ($attributes['mapUrl'] ?? ''));
if (
    $mapUrl !== ''
    && class_exists(\RRZE\Directions\FauMapIframe::class)
    && \RRZE\Directions\FauMapIframe::isApiIframeUrl($mapUrl)
) {
    $mapUrlCanonical = \RRZE\Directions\FauMapIframe::canonicalIframeSrc($mapUrl);
    if ($mapUrlCanonical !== '') {
        $mapUrl = $mapUrlCanonical;
    }
}
$mapImageId = isset($attributes['mapImageId']) ? (int) $attributes['mapImageId'] : 0;

$karteIframeSrc = class_exists(\RRZE\Directions\FauMapIframe::class)
    ? \RRZE\Directions\FauMapIframe::resolveIframeSrc($attributes)
    : '';

[$mapLatitude, $mapLongitude] = class_exists(\RRZE\Directions\MapLinks::class)
    ? \RRZE\Directions\MapLinks::coordinatesFromAttributes($attributes)
    : [null, null];

$streetLine = class_exists(\RRZE\Directions\AddressPresentation::class)
    ? \RRZE\Directions\AddressPresentation::streetLine($addressStreet, $addressZip, $addressCity)
    : '';

$showFormattedAddress = class_exists(\RRZE\Directions\AddressPresentation::class)
    ? \RRZE\Directions\AddressPresentation::shouldShowFormattedAddress($addressFormatted, $streetLine)
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

$class = trim('wp-block-rrze-directions rrze-directions');
?>
<section class="<?php echo esc_attr($class); ?>">
    <div class="rrze-directions__body">
        <h2 class="rrze-directions__title"><?php echo esc_html__('Directions', 'rrze-directions'); ?></h2>

        <address class="rrze-directions__address">
            <?php if ($organizationName !== '') : ?>
                <span class="rrze-directions__org"><?php echo esc_html($organizationName); ?></span><br>
            <?php endif; ?>

            <?php if ($addressRoom !== '') : ?>
                <span class="rrze-directions__room">
                    <?php
                    echo esc_html(
                        sprintf(
                            /* translators: %s: room number */
                            __('Room: %s', 'rrze-directions'),
                            $addressRoom
                        )
                    );
                    ?>
                </span><br>
            <?php endif; ?>

            <?php if ($addressFloor !== '') : ?>
                <span class="rrze-directions__floor">
                    <?php
                    echo esc_html(
                        sprintf(
                            /* translators: %s: floor */
                            __('Floor: %s', 'rrze-directions'),
                            $addressFloor
                        )
                    );
                    ?>
                </span><br>
            <?php endif; ?>

            <?php if ($streetLine !== '') : ?>
                <span class="rrze-directions__street"><?php echo esc_html($streetLine); ?></span><br>
            <?php elseif ($showFormattedAddress) : ?>
                <span class="rrze-directions__street"><?php echo esc_html($addressFormatted); ?></span><br>
            <?php elseif ('' === $organizationName) : ?>
                <?php echo esc_html__('Address data unavailable.', 'rrze-directions'); ?><br>
            <?php endif; ?>

            <?php if ($showFormattedAddress && $streetLine !== '') : ?>
                <span class="rrze-directions__meta"><?php echo esc_html($addressFormatted); ?></span>
            <?php endif; ?>

            <?php if (null !== $mapLatitude && null !== $mapLongitude) : ?>
                <br>
                <?php echo esc_html(\RRZE\Directions\MapLinks::formatCoordinatePair($mapLatitude, $mapLongitude)); ?>
                <span class="rrze-directions__link-sep" aria-hidden="true"> · </span>
                <a href="<?php echo esc_url(\RRZE\Directions\MapLinks::googleMapsUrl($mapLatitude, $mapLongitude), ['https']); ?>">
                    <?php echo esc_html__('Google Maps', 'rrze-directions'); ?>
                </a>
                <span class="rrze-directions__link-sep" aria-hidden="true"> · </span>
                <a href="<?php echo esc_url(\RRZE\Directions\MapLinks::appleMapsUrl($mapLatitude, $mapLongitude), ['https']); ?>">
                    <?php echo esc_html__('Apple Maps', 'rrze-directions'); ?>
                </a>
            <?php endif; ?>
        </address>

        <?php if ($mapImageId > 0) : ?>
            <figure class="rrze-directions__map-image">
                <?php
                echo wp_get_attachment_image(
                    $mapImageId,
                    'large',
                    false,
                    [
                        'class'    => 'rrze-directions__map-img',
                        'decoding' => 'async',
                        'loading'  => 'lazy',
                    ]
                );
                ?>
            </figure>
        <?php endif; ?>

        <div class="rrze-directions__map">
            <h3 class="rrze-directions__map-title"><?php echo esc_html__('Arrival map', 'rrze-directions'); ?></h3>

            <?php if ($karteIframeSrc !== '') : ?>
                <div class="rrze-directions__map-frame">
                    <iframe
                        title="<?php echo esc_attr__('FAU map service', 'rrze-directions'); ?>"
                        src="<?php echo esc_url($karteIframeSrc, ['https']); ?>"
                        class="rrze-directions__iframe"
                        loading="lazy"
                        referrerpolicy="no-referrer-when-downgrade"></iframe>
                </div>
                <?php if ($showExtraLink) : ?>
                    <p class="rrze-directions__map-extra">
                        <a href="<?php echo $mapLinkOnly; ?>"><?php echo esc_html__('Additional map link', 'rrze-directions'); ?></a>
                    </p>
                <?php endif; ?>
            <?php elseif ($mapLinkOnly !== '') : ?>
                <p class="rrze-directions__map-link">
                    <a href="<?php echo $mapLinkOnly; ?>"><?php echo esc_html__('Open map link', 'rrze-directions'); ?></a>
                </p>
            <?php else : ?>
                <p class="rrze-directions__map-empty">
                    <?php echo esc_html__('No map parameters available (add FAUdir data or a Map URL).', 'rrze-directions'); ?></p>
            <?php endif; ?>
        </div>

        <?php
        $directionsHtml = class_exists(\RRZE\Directions\DirectionsPresentation::class)
            ? \RRZE\Directions\DirectionsPresentation::render($attributes)
            : '';

        if ($directionsHtml !== '') {
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in DirectionsPresentation.
            echo $directionsHtml;
        }
        ?>

    </div>
</section>
