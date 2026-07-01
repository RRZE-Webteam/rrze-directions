<?php

/*
Plugin Name:        RRZE Directions
Plugin URI:         https://github.com/RRZE-Webteam/
Version:            1.0.60
Description:        Arrival and directions as a Gutenberg block: RRZE-FAUdir addresses, karte.fau.de embed, and OpenRouteService route maps.
Author:             RRZE Webteam
Author URI:         https://www.wp.rrze.fau.de/
License:            GNU General Public License Version 3
License URI:        https://www.gnu.org/licenses/gpl-3.0.html
Text Domain:        rrze-directions
Domain Path:        /languages
Requires at least:   6.8
Requires PHP:       8.2
*/

namespace RRZE\Directions;

use RRZE\Directions\Common\Plugin\Plugin;

defined('ABSPATH') || exit;

const RRZE_DIRECTIONS_FAUDIR_PLUGIN = 'rrze-faudir/rrze-faudir.php';

spl_autoload_register(static function ($class): void {
    $prefix  = __NAMESPACE__;
    $baseDir = __DIR__ . '/includes/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file          = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

register_activation_hook(__FILE__, __NAMESPACE__ . '\activation_hook');

add_action('plugins_loaded', __NAMESPACE__ . '\plugins_loaded');


function activation_hook(): void
{
    if (!defined('ABSPATH')) {
        return;
    }

    require_once ABSPATH . 'wp-admin/includes/plugin.php';

    if (!is_plugin_active(RRZE_DIRECTIONS_FAUDIR_PLUGIN)) {
        deactivate_plugins(plugin_basename(__FILE__));
        set_transient('rrze_directions_activation_requires_faudir', 1, 120);
        return;
    }

    if (!class_exists(\RRZE\FAUdir\API::class)) {
        deactivate_plugins(plugin_basename(__FILE__));
        set_transient('rrze_directions_activation_requires_faudir', 2, 120);
        return;
    }
}


function plugins_loaded(): void
{
    plugin()->loaded();

    add_action('init', __NAMESPACE__ . '\load_textdomain');

    add_action('admin_notices', __NAMESPACE__ . '\admin_notice_activation_blocked');

    $wpCompatible   = is_wp_version_compatible(plugin()->getRequiresWP());
    $phpCompatible  = is_php_version_compatible(plugin()->getRequiresPHP());

    if (!$wpCompatible || !$phpCompatible) {
        add_action('admin_notices', __NAMESPACE__ . '\requirements_notice_fatal');
        return;
    }

    if (!faudir_is_active()) {
        add_action('admin_notices', __NAMESPACE__ . '\admin_notice_faudir_runtime');
        return;
    }

    main();

    Settings::init();

    add_action('init', __NAMESPACE__ . '\register_blocks');
}


function plugin(): Plugin
{
    static $instance;

    if (null === $instance) {
        $instance = new Plugin(__FILE__);
    }

    return $instance;
}


function main(): Main
{
    static $instance;

    if (null === $instance) {
        $instance = new Main();
    }

    return $instance;
}


function faudir_is_active(): bool
{
    if (!function_exists('is_plugin_active')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    return is_plugin_active(RRZE_DIRECTIONS_FAUDIR_PLUGIN) && class_exists(\RRZE\FAUdir\API::class);
}


function admin_notice_activation_blocked(): void
{
    if (!current_user_can('activate_plugins')) {
        return;
    }

    $flag = get_transient('rrze_directions_activation_requires_faudir');
    if (empty($flag)) {
        return;
    }

    delete_transient('rrze_directions_activation_requires_faudir');

    $message = (int) $flag === 2
        ? __('RRZE Directions has been deactivated because RRZE-FAUdir is installed but failed to initialize fully.', 'rrze-directions')
        : __('RRZE Directions requires RRZE-FAUdir to be installed and active. The plugin cannot be activated without it.', 'rrze-directions');

    printf(
        '<div class="notice notice-error is-dismissible"><p>%s</p></div>',
        esc_html($message)
    );
}


function admin_notice_faudir_runtime(): void
{
    if (!is_admin()) {
        return;
    }

    if (!current_user_can('manage_options')) {
        return;
    }

    echo '<div class="notice notice-error"><p>'
        . esc_html__(
            'RRZE Directions is inactive because RRZE-FAUdir is not active.',
            'rrze-directions'
        )
        . '</p></div>';
}


function requirements_notice_fatal(): void
{
    if (!current_user_can('activate_plugins')) {
        return;
    }

    $pluginName = plugin()->getName();
    $wpOk       = is_wp_version_compatible(plugin()->getRequiresWP());
    $phpOk      = is_php_version_compatible(plugin()->getRequiresPHP());

    if ($wpOk && $phpOk) {
        return;
    }

    $error = '';
    if (!$wpOk) {
        $error = sprintf(
            /* translators: 1: current WordPress version, 2: required WP version */
            __('The server is running WordPress version %1$s. RRZE Directions requires WordPress version %2$s or higher.', 'rrze-directions'),
            wp_get_wp_version(),
            plugin()->getRequiresWP()
        );
    } elseif (!$phpOk) {
        $error = sprintf(
            /* translators: 1: current PHP version, 2: required PHP version */
            __('The server is running PHP version %1$s. RRZE Directions requires PHP version %2$s or higher.', 'rrze-directions'),
            PHP_VERSION,
            plugin()->getRequiresPHP()
        );
    }

    if ($error === '') {
        return;
    }

    printf(
        '<div class="notice notice-error"><p>%s</p><p>%s</p></div>',
        esc_html($pluginName),
        esc_html($error)
    );
}


function load_textdomain(): void
{
    load_plugin_textdomain(
        'rrze-directions',
        false,
        dirname(plugin_basename(__FILE__)) . '/languages'
    );
}


function register_blocks(): void
{
    register_block_type(__DIR__ . '/build');
    $scriptHandle = generate_block_asset_handle('rrze/directions', 'editorScript');
    wp_set_script_translations($scriptHandle, 'rrze-directions', plugin_dir_path(__FILE__) . 'languages');

    register_block_categories();
}


function register_block_categories(): void
{
    static $done;

    if ($done) {
        return;
    }
    $done = true;

    add_filter(
        'block_categories_all',
        static function (array $categories): array {
            foreach ($categories as $cat) {
                if (($cat['slug'] ?? '') === 'rrze') {
                    return $categories;
                }
            }

            array_unshift(
                $categories,
                [
                    'slug'  => 'rrze',
                    'title' => 'RRZE',
                ]
            );

            return $categories;
        },
        10
    );
}
