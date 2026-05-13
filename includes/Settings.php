<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Plugin settings (OpenRouteService API key).
 *
 * @link https://openrouteservice.org
 */
final class Settings
{
    public const OPTION_KEY = 'rrze_direction_openrouteservice_api_key';

    public const PAGE_SLUG = 'rrze-direction-settings';

    public const OPTION_GROUP = 'rrze_direction_settings';

    public static function init(): void
    {
        if (!is_admin()) {
            return;
        }

        add_action('admin_menu', [self::class, 'addMenuPage']);
        add_action('admin_init', [self::class, 'registerSetting']);
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
                esc_html__('Settings', 'rrze-direction')
            )
        );

        return $links;
    }

    public static function addMenuPage(): void
    {
        add_options_page(
            __('RRZE Direction', 'rrze-direction'),
            __('RRZE Direction', 'rrze-direction'),
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
            isset($_POST['rrze_direction_clear_openrouteservice_api_key'])
            && (string) wp_unslash($_POST['rrze_direction_clear_openrouteservice_api_key']) === '1'
        ) {
            return '';
        }

        $new = is_string($value) ? trim($value) : '';
        if ($new === '') {
            $old = get_option(self::OPTION_KEY, '');

            return is_string($old) ? $old : '';
        }

        return sanitize_text_field($new);
    }

    public static function renderPage(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $hasKey = self::getOpenRouteServiceApiKey() !== '';
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form action="options.php" method="post">
                <?php settings_fields(self::OPTION_GROUP); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">
                            <label for="rrze_direction_openrouteservice_api_key">
                                <?php esc_html_e('OpenRouteService API key', 'rrze-direction'); ?>
                            </label>
                        </th>
                        <td>
                            <input
                                type="password"
                                name="<?php echo esc_attr(self::OPTION_KEY); ?>"
                                id="rrze_direction_openrouteservice_api_key"
                                value=""
                                class="regular-text code"
                                autocomplete="new-password"
                            />
                            <p class="description">
                                <?php
                                echo esc_html(
                                    sprintf(
                                        /* translators: %s: URL to openrouteservice.org */
                                        __('Request a key from %s (dashboard) and paste it here. Leave the field empty when saving to keep the current key.', 'rrze-direction'),
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
                                            name="rrze_direction_clear_openrouteservice_api_key"
                                            value="1"
                                        />
                                        <?php esc_html_e('Remove stored API key', 'rrze-direction'); ?>
                                    </label>
                                </p>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e('Route start', 'rrze-direction'); ?></th>
                        <td>
                            <p class="description" style="margin-top:0;">
                                <?php esc_html_e('For workplaces in Erlangen, Nuremberg, or Fürth, draft routes use the respective main station as the start: Erlangen Hauptbahnhof, Nürnberg Hauptbahnhof, or Fürth (main) station.', 'rrze-direction'); ?>
                            </p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
}
