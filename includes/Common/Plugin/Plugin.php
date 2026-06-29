<?php

namespace RRZE\Directions\Common\Plugin;

defined('ABSPATH') || exit;

/**
 * Plugin metadata loader (paths, header data, WP/PHP requirements).
 */
class Plugin
{
    protected string $pluginFile;
    protected string $basename = '';
    protected string $directory = '';
    protected string $url = '';
    protected array $data = [];

    public function __construct(string $pluginFile)
    {
        $this->pluginFile = $pluginFile;
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    public function loaded(): void
    {
        $this->setBasename()
            ->setDirectory()
            ->setUrl()
            ->setData();
    }

    public function getFile(): string
    {
        return $this->pluginFile;
    }

    public function getBasename(): string
    {
        return $this->basename;
    }

    protected function setBasename(): self
    {
        $this->basename = plugin_basename($this->pluginFile);
        return $this;
    }

    public function getDirectory(): string
    {
        return $this->directory;
    }

    protected function setDirectory(): self
    {
        $this->directory = rtrim(plugin_dir_path($this->pluginFile), '/') . '/';
        return $this;
    }

    public function getPath(string $path = ''): string
    {
        return $this->directory . ($path ? trim($path, '/') . '/' : '');
    }

    public function getUrl(string $path = ''): string
    {
        return $this->url . ($path ? trim($path, '/') . '/' : '');
    }

    protected function setUrl(): self
    {
        $this->url = rtrim(plugin_dir_url($this->pluginFile), '/') . '/';
        return $this;
    }

    public function getSlug(): string
    {
        return sanitize_key(dirname($this->basename));
    }

    protected function setData(): self
    {
        $this->data = get_plugin_data($this->pluginFile, false);
        return $this;
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function getName(): string
    {
        return $this->data['Name'] ?? '';
    }

    public function getVersion(): string
    {
        return $this->data['Version'] ?? '';
    }

    public function getRequiresWP(): string
    {
        return $this->data['RequiresWP'] ?? '';
    }

    public function getRequiresPHP(): string
    {
        return $this->data['RequiresPHP'] ?? '';
    }

    public function __call(string $name, array $arguments)
    {
        if (!method_exists($this, $name)) {
            $message = sprintf('Call to undefined method %1$s::%2$s', __CLASS__, $name);
            if (defined('WP_DEBUG') && WP_DEBUG) {
                throw new \Exception($message);
            }
        }
    }
}
