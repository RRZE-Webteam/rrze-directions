<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Address fragments for block output without duplicate lines.
 */
final class AddressPresentation
{
    public static function streetLine(string $street, string $zip, string $city): string
    {
        $parts = array_filter(
            [$street, trim($zip . ' ' . $city)],
            static fn(string $value): bool => $value !== ''
        );

        return implode(', ', $parts);
    }

    public static function destinationLine(
        string $street,
        string $zip,
        string $city,
        string $formatted = ''
    ): string {
        $streetLine = self::streetLine($street, $zip, $city);
        if ($streetLine !== '') {
            return $streetLine;
        }

        $formatted = trim($formatted);
        if ($formatted !== '') {
            return $formatted;
        }

        return trim($city);
    }

    public static function shouldShowFormattedAddress(string $formatted, string $streetLine): bool
    {
        $formatted = trim($formatted);
        if ($formatted === '') {
            return false;
        }

        if ($streetLine === '') {
            return true;
        }

        return self::normalizeAddress($formatted) !== self::normalizeAddress($streetLine);
    }

    private static function normalizeAddress(string $value): string
    {
        $value = strtolower(trim($value));
        if ($value === '') {
            return '';
        }

        $value = remove_accents($value);

        return preg_replace('/\s+/', ' ', $value) ?? '';
    }
}
