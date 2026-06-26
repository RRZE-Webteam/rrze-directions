<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Persistent cache for external API responses (karte.fau.de, OpenRouteService, FAUdir).
 */
final class ApiCache
{
    private const INDEX_OPTION = 'rrze_direction_api_cache_index';

    private const OPTION_PREFIX = 'rrze_direction_api_cache_';

    private const SCHEMA_VERSION = 1;

    /** Successful responses are kept until manual flush. */
    private const TTL_SUCCESS = 0;

    /** Short-lived cache for empty or failed lookups. */
    private const TTL_NEGATIVE = 7 * DAY_IN_SECONDS;

    /** @var array<string, mixed> */
    private static array $requestCache = [];

    /**
     * @template T
     *
     * @param callable(): T $producer
     * @param callable(T): bool|null $isNegative
     *
     * @return T
     */
    public static function remember(string $group, string $key, callable $producer, ?callable $isNegative = null): mixed
    {
        $storageKey = self::storageKey($group, $key);

        if (array_key_exists($storageKey, self::$requestCache)) {
            return self::$requestCache[$storageKey];
        }

        $stored = get_option($storageKey, null);
        if (is_array($stored) && self::isValidEntry($stored)) {
            self::$requestCache[$storageKey] = $stored['value'];

            return $stored['value'];
        }

        if (is_array($stored)) {
            self::deleteEntry($storageKey);
        }

        $value = $producer();
        $negative = $isNegative ? (bool) $isNegative($value) : false;
        self::setValue($group, $key, $value, $negative ? self::TTL_NEGATIVE : self::TTL_SUCCESS);
        self::$requestCache[$storageKey] = $value;

        return $value;
    }

    public static function flushAll(): int
    {
        $index = get_option(self::INDEX_OPTION, []);
        $count = 0;

        if (is_array($index)) {
            foreach ($index as $storageKey) {
                if (!is_string($storageKey) || $storageKey === '') {
                    continue;
                }

                if (delete_option($storageKey)) {
                    ++$count;
                }
            }
        }

        delete_option(self::INDEX_OPTION);
        self::$requestCache = [];

        return $count;
    }

    public static function flushGroup(string $group): int
    {
        $prefix = self::OPTION_PREFIX . self::sanitizeGroup($group) . '_';
        $index  = get_option(self::INDEX_OPTION, []);
        $count  = 0;

        if (!is_array($index)) {
            return 0;
        }

        $remaining = [];

        foreach ($index as $storageKey) {
            if (!is_string($storageKey) || !str_starts_with($storageKey, $prefix)) {
                $remaining[] = $storageKey;
                continue;
            }

            if (delete_option($storageKey)) {
                ++$count;
            }

            unset(self::$requestCache[$storageKey]);
        }

        update_option(self::INDEX_OPTION, array_values($remaining), false);

        return $count;
    }

    public static function entryCount(): int
    {
        $index = get_option(self::INDEX_OPTION, []);

        return is_array($index) ? count($index) : 0;
    }

    /**
     * @param mixed $value Must be JSON-serializable.
     */
    public static function setValue(string $group, string $key, mixed $value, int $ttl = self::TTL_SUCCESS): void
    {
        $storageKey = self::storageKey($group, $key);
        $expires    = $ttl > 0 ? time() + $ttl : 0;

        update_option(
            $storageKey,
            [
                'v'       => self::SCHEMA_VERSION,
                'expires' => $expires,
                'value'   => $value,
            ],
            false
        );

        self::addToIndex($storageKey);
        self::$requestCache[$storageKey] = $value;
    }

    public static function hashKey(mixed ...$parts): string
    {
        $encoded = wp_json_encode($parts);

        return hash('sha256', is_string($encoded) ? $encoded : serialize($parts));
    }

    private static function storageKey(string $group, string $key): string
    {
        return self::OPTION_PREFIX . self::sanitizeGroup($group) . '_' . hash('sha256', $key);
    }

    private static function sanitizeGroup(string $group): string
    {
        $group = strtolower(trim($group));
        $group = preg_replace('/[^a-z0-9_-]+/', '-', $group) ?? 'default';

        return $group !== '' ? $group : 'default';
    }

    /**
     * @param array<string, mixed> $stored
     */
    private static function isValidEntry(array $stored): bool
    {
        if ((int) ($stored['v'] ?? 0) !== self::SCHEMA_VERSION) {
            return false;
        }

        $expires = (int) ($stored['expires'] ?? 0);
        if ($expires > 0 && $expires < time()) {
            return false;
        }

        return array_key_exists('value', $stored);
    }

    private static function addToIndex(string $storageKey): void
    {
        $index = get_option(self::INDEX_OPTION, []);
        if (!is_array($index)) {
            $index = [];
        }

        if (!in_array($storageKey, $index, true)) {
            $index[] = $storageKey;
            update_option(self::INDEX_OPTION, $index, false);
        }
    }

    private static function deleteEntry(string $storageKey): void
    {
        delete_option($storageKey);

        $index = get_option(self::INDEX_OPTION, []);
        if (!is_array($index)) {
            return;
        }

        $index = array_values(array_filter(
            $index,
            static fn(mixed $entry): bool => $entry !== $storageKey
        ));

        update_option(self::INDEX_OPTION, $index, false);
        unset(self::$requestCache[$storageKey]);
    }
}
