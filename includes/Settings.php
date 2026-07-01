<?php

declare(strict_types=1);

namespace RRZE\Directions;

defined('ABSPATH') || exit;

/**
 * Plugin settings (OpenRouteService API key).
 *
 * @link https://openrouteservice.org
 */
final class Settings
{
    public const OPTION_KEY = 'rrze_directions_openrouteservice_api_key';

    public const PAGE_SLUG = 'rrze-directions-settings';

    public const OPTION_GROUP = 'rrze_directions_settings';

    private const GUIDED_TOUR_DISMISSED_META = 'rrze_directions_guided_tour_dismissed';

    private const SETUP_TOUR_DISMISSED_META = 'rrze_directions_setup_tour_dismissed';

    public static function init(): void
    {
        if (!is_admin()) {
            return;
        }

        add_action('admin_menu', [self::class, 'addMenuPage']);
        add_action('admin_init', [self::class, 'registerSetting']);
        add_action('admin_init', [self::class, 'handleCacheFlush']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueueGuidedTour']);
        add_action('wp_ajax_rrze_directions_dismiss_guided_tour', [self::class, 'dismissGuidedTour']);
        add_action('wp_ajax_rrze_directions_dismiss_setup_tour', [self::class, 'dismissSetupTour']);
        add_filter(
            'plugin_action_links_' . plugin_basename(plugin()->getFile()),
            [self::class, 'actionLinks']
        );
    }

    public static function getOpenRouteServiceApiKey(): string
    {
        $key = get_option(self::OPTION_KEY, '');

        return is_string($key) ? trim($key) : '';
    }

    /**
     * @param array<string, string> $links
     *
     * @return array<string, string>
     */
    public static function actionLinks(array $links): array
    {
        $url = admin_url('options-general.php?page=' . self::PAGE_SLUG);

        array_unshift(
            $links,
            sprintf(
                '<a href="%s">%s</a>',
                esc_url($url),
                esc_html__('Settings', 'rrze-directions')
            )
        );

        return $links;
    }

    public static function addMenuPage(): void
    {
        add_options_page(
            __('RRZE Directions', 'rrze-directions'),
            __('RRZE Directions', 'rrze-directions'),
            'manage_options',
            self::PAGE_SLUG,
            [self::class, 'renderPage']
        );
    }

    public static function registerSetting(): void
    {
        register_setting(
            self::OPTION_GROUP,
            self::OPTION_KEY,
            [
                'type'              => 'string',
                'sanitize_callback' => [self::class, 'sanitizeApiKey'],
                'default'           => '',
            ]
        );
    }

    public static function sanitizeApiKey(mixed $value): string
    {
        if (
            isset($_POST['rrze_directions_clear_openrouteservice_api_key'])
            && (string) wp_unslash($_POST['rrze_directions_clear_openrouteservice_api_key']) === '1'
        ) {
            return '';
        }

        $new = is_string($value) ? trim($value) : '';
        if ($new === '') {
            $old = get_option(self::OPTION_KEY, '');

            return is_string($old) ? $old : '';
        }

        $old = get_option(self::OPTION_KEY, '');
        $old = is_string($old) ? trim($old) : '';
        if ($new !== $old) {
            ApiCache::flushGroup('openroute');
        }

        return sanitize_text_field($new);
    }

    public static function handleCacheFlush(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        if (
            !isset($_POST['rrze_directions_flush_api_cache'])
            || (string) wp_unslash($_POST['rrze_directions_flush_api_cache']) !== '1'
        ) {
            return;
        }

        check_admin_referer('rrze_directions_flush_api_cache');

        $count = ApiCache::flushAll();

        add_settings_error(
            'rrze_directions_settings',
            'cache_flushed',
            sprintf(
                /* translators: %d: number of removed cache entries */
                __('API cache cleared (%d entries removed).', 'rrze-directions'),
                $count
            ),
            'updated'
        );
    }

    public static function enqueueGuidedTour(string $hook): void
    {
        if ($hook !== 'settings_page_' . self::PAGE_SLUG) {
            return;
        }

        $scriptPath = plugin()->getPath() . 'build/rrze-directions-guided-tour.js';
        $assetPath  = plugin()->getPath() . 'build/rrze-directions-guided-tour.asset.php';

        if (!is_readable($scriptPath) || !is_readable($assetPath)) {
            return;
        }

        /** @var array{dependencies: string[], version: string} $asset */
        $asset = include $assetPath;

        wp_enqueue_style('dashicons');
        wp_enqueue_style('wp-components');

        wp_enqueue_script(
            'rrze-directions-guided-tour',
            plugin()->getUrl() . 'build/rrze-directions-guided-tour.js',
            $asset['dependencies'],
            $asset['version'],
            true
        );

        wp_set_script_translations(
            'rrze-directions-guided-tour',
            'rrze-directions',
            plugin()->getPath() . 'languages'
        );

        $setupTourStepId = '';
        if (isset($_GET['rrze_setup_tour_step'])) {
            $setupTourStepId = sanitize_text_field((string) wp_unslash($_GET['rrze_setup_tour_step']));
        }

        wp_localize_script('rrze-directions-guided-tour', 'rrzeDirectionsGuide', [
            'autoStart'      => !get_user_meta(get_current_user_id(), self::GUIDED_TOUR_DISMISSED_META, true),
            'autoStartSetup' => isset($_GET['rrze_setup_tour']),
            'setupTourStepId'=> $setupTourStepId,
            'settingsUrl'    => admin_url('options-general.php?page=' . self::PAGE_SLUG),
            'ajaxUrl'        => admin_url('admin-ajax.php'),
            'nonce'          => wp_create_nonce('rrze_directions_guided_tour'),
            'setupTourNonce' => wp_create_nonce('rrze_directions_setup_tour'),
            'githubUrl'      => 'https://github.com/RRZE-Webteam/rrze-directions',
            'docuUrl'        => 'https://www.wp.rrze.fau.de/',
        ]);
    }

    public static function dismissGuidedTour(): void
    {
        check_ajax_referer('rrze_directions_guided_tour', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(null, 403);
        }

        update_user_meta(get_current_user_id(), self::GUIDED_TOUR_DISMISSED_META, 1);
        wp_send_json_success();
    }

    public static function dismissSetupTour(): void
    {
        check_ajax_referer('rrze_directions_setup_tour', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(null, 403);
        }

        update_user_meta(get_current_user_id(), self::SETUP_TOUR_DISMISSED_META, 1);
        wp_send_json_success();
    }

    public static function renderPage(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $hasKey = self::getOpenRouteServiceApiKey() !== '';
        $apiKey = self::getOpenRouteServiceApiKey();
        $cacheEntries = ApiCache::entryCount();
        $editorUrl = admin_url('post-new.php?post_type=page');
        ?>
        <div class="wrap rrze-directions-settings-wrap">
            <h1 class="wp-heading-inline"><?php echo esc_html(get_admin_page_title()); ?></h1>
            <button type="button" id="rrze-directions-start-guided-tour" class="page-title-action">
                <?php esc_html_e('About', 'rrze-directions'); ?>
            </button>
            <button type="button" id="rrze-directions-start-setup-tour" class="page-title-action">
                <?php esc_html_e('Tour', 'rrze-directions'); ?>
            </button>
            <hr class="wp-header-end">
            <div id="rrze-directions-guided-tour-root"></div>

            <?php settings_errors('rrze_directions_settings'); ?>

            <form action="options.php" method="post">
                <?php settings_fields(self::OPTION_GROUP); ?>
                <table class="form-table" role="presentation">
                    <tr data-rrze-tour="openroute-api-key">
                        <th scope="row">
                            <label for="rrze_directions_openrouteservice_api_key">
                                <?php esc_html_e('OpenRouteService API key', 'rrze-directions'); ?>
                            </label>
                        </th>
                        <td>
                            <input
                                type="text"
                                name="<?php echo esc_attr(self::OPTION_KEY); ?>"
                                id="rrze_directions_openrouteservice_api_key"
                                value="<?php echo esc_attr($apiKey); ?>"
                                class="regular-text code"
                                autocomplete="off"
                            />
                            <p class="description">
                                <?php
                                echo esc_html(
                                    sprintf(
                                        /* translators: %s: URL to openrouteservice.org */
                                        __('Request a key from %s (dashboard) and paste it here.', 'rrze-directions'),
                                        'https://openrouteservice.org'
                                    )
                                );
                                ?>
                            </p>
                            <?php if ($hasKey) : ?>
                                <p>
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="rrze_directions_clear_openrouteservice_api_key"
                                            value="1"
                                        />
                                        <?php esc_html_e('Remove stored API key', 'rrze-directions'); ?>
                                    </label>
                                </p>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <tr data-rrze-tour="route-start">
                        <th scope="row"><?php esc_html_e('Route start', 'rrze-directions'); ?></th>
                        <td>
                            <p class="description" style="margin-top:0;">
                                <?php esc_html_e('Draft routes are always generated from all three starting points: Erlangen Hauptbahnhof, Nürnberg Hauptbahnhof, and Nürnberg Flughafen NUE.', 'rrze-directions'); ?>
                            </p>
                        </td>
                    </tr>
                </table>
                <p data-rrze-tour="save-settings">
                    <?php submit_button(); ?>
                </p>
            </form>

            <div data-rrze-tour="api-cache">
                <h2><?php esc_html_e('API cache', 'rrze-directions'); ?></h2>
                <p>
                    <?php
                    echo esc_html(
                        sprintf(
                            /* translators: %d: number of cached API responses */
                            _n(
                                '%d cached API response is stored permanently for faster loading.',
                                '%d cached API responses are stored permanently for faster loading.',
                                $cacheEntries,
                                'rrze-directions'
                            ),
                            $cacheEntries
                        )
                    );
                    ?>
                </p>
                <p class="description">
                    <?php esc_html_e('Responses from karte.fau.de, OpenRouteService, and FAUdir are cached until you clear the cache or relevant data changes.', 'rrze-directions'); ?>
                </p>
            </div>
            <form method="post" data-rrze-tour="clear-cache">
                <?php wp_nonce_field('rrze_directions_flush_api_cache'); ?>
                <input type="hidden" name="rrze_directions_flush_api_cache" value="1" />
                <?php
                submit_button(
                    __('Clear API cache', 'rrze-directions'),
                    'secondary',
                    'submit',
                    false
                );
                ?>
            </form>

            <p data-rrze-tour="block-editor" class="description">
                <?php
                printf(
                    /* translators: %s: link to create a new page in the editor */
                    esc_html__(
                        'Insert the RRZE Directions block when editing a page: %s',
                        'rrze-directions'
                    ),
                    '<a href="' . esc_url($editorUrl) . '">'
                    . esc_html__('Open block editor', 'rrze-directions')
                    . '</a>'
                );
                ?>
            </p>
        </div>
        <?php
    }
}
