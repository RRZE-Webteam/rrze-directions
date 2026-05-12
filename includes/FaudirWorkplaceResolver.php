<?php

declare(strict_types=1);

namespace RRZE\Direction;

defined('ABSPATH') || exit;

/**
 * Resolves FAUdir contacts and workplaces for block snapshots and map defaults.
 */
final class FaudirWorkplaceResolver
{
    /**
     * Build person/workplace rows for the block editor (inline script payload shape).
     *
     * @return array{error:bool, message:string, data:array<int, array<string, mixed>>}
     */
    public static function personsWithWorkplaces(?\RRZE\FAUdir\API $api = null): array
    {
        if (!post_type_exists('custom_person')) {
            return [
                'error'   => true,
                'message' => __('The FAUdir person custom post type is not registered.', 'rrze-direction'),
                'data'    => [],
            ];
        }

        if (!class_exists(\RRZE\FAUdir\API::class) || !class_exists(\RRZE\FAUdir\Config::class)) {
            return [
                'error'   => true,
                'message' => __('FAUdir API classes are not available.', 'rrze-direction'),
                'data'    => [],
            ];
        }

        $config = new \RRZE\FAUdir\Config();
        $ptype  = (string) $config->get('person_post_type');
        if ($ptype === '') {
            $ptype = 'custom_person';
        }

        if (!post_type_exists($ptype)) {
            return [
                'error'   => true,
                'message' => __('The configured FAUdir person post type does not exist.', 'rrze-direction'),
                'data'    => [],
            ];
        }

        $api = $api ?? new \RRZE\FAUdir\API($config);

        $posts = get_posts([
            'post_type'      => $ptype,
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC',
            'no_found_rows'  => true,
            'fields'         => 'ids',
        ]);

        $rows = [];

        foreach ($posts as $postId) {
            $faudirPersonId = (string) get_post_meta((int) $postId, 'person_id', true);
            if ($faudirPersonId === '') {
                continue;
            }

            $person = $api->getPerson($faudirPersonId);
            if (!is_array($person) || $person === []) {
                continue;
            }

            $given  = $person['givenName'] ?? '';
            $family = $person['familyName'] ?? '';
            $title  = trim("$given $family") ?: get_the_title((int) $postId);

            $places = [];

            foreach ($person['contacts'] ?? [] as $contactStub) {
                if (!is_array($contactStub)) {
                    continue;
                }
                $contactId = isset($contactStub['identifier']) ? (string) $contactStub['identifier'] : '';
                if ($contactId === '') {
                    continue;
                }

                $contactDetail = $api->getContact($contactId);
                if (!is_array($contactDetail) || $contactDetail === []) {
                    $contactDetail = $contactStub;
                }

                $orgName = '';
                if (!empty($contactDetail['organization']['name']) && is_string($contactDetail['organization']['name'])) {
                    $orgName = $contactDetail['organization']['name'];
                } elseif (!empty($contactStub['organization']['name']) && is_string($contactStub['organization']['name'])) {
                    $orgName = $contactStub['organization']['name'];
                }

                $orgPayload = (array) ($contactDetail['organization'] ?? $contactStub['organization'] ?? []);
                $orgNumber  = self::organizationNumberFromOrg($orgPayload);

                foreach ($contactDetail['workplaces'] ?? [] as $wi => $workplace) {
                    if (!is_array($workplace)) {
                        continue;
                    }

                    [$lat, $lon] = self::extractCoordinates($workplace);
                    $street      = self::streetLine($workplace);
                    $zip         = self::zip($workplace);
                    $city        = self::city($workplace);
                    $faumap      = isset($workplace['faumap']) && is_string($workplace['faumap']) ? trim($workplace['faumap']) : '';

                    if (null === $lat || null === $lon) {
                        [$lat, $lon] = FauMapGeojson::resolveCoordinates(
                            $workplace,
                            $orgNumber,
                            $street,
                            $zip,
                            $city,
                            $faumap
                        );
                    }

                    $room  = isset($workplace['room']) && is_string($workplace['room']) ? $workplace['room'] : '';
                    $floor = isset($workplace['floor']) && is_string($workplace['floor']) ? $workplace['floor'] : '';

                    if ($street === '' && $zip === '' && $city === '') {
                        continue;
                    }

                    $key = $contactId . '::' . (string) $wi;

                    $parts     = array_filter([$street, trim($zip . ' ' . $city)]);
                    $formatted = implode(', ', $parts);
                    $roomFlo   = trim(
                        $room . (
                            ($floor !== '' && $room !== '')
                            ? ', ' . $floor
                            : ($floor !== '' ? $floor : '')
                        )
                    );

                    $places[$key] = [
                        'id'                => $key,
                        'contactIdentifier' => $contactId,
                        'workplaceIndex'    => (int) $wi,
                        'label'             => implode(' — ', array_filter(array_unique(array_filter([
                            $orgName ?: null,
                            $roomFlo ?: null,
                            $formatted ?: null,
                        ])))),
                        'organizationName'   => $orgName,
                        'organizationNumber' => $orgNumber,
                        'room'               => $room,
                        'floor'            => $floor,
                        'street'           => self::streetLine($workplace),
                        'zip'              => $zip,
                        'city'             => $city,
                        'formattedAddress' => $formatted,
                        'faumap'           => $faumap,
                        'latitude'         => $lat,
                        'longitude'        => $lon,
                    ];
                }
            }

            // Person-level workplaces fallback (often empty)
            if ($places === [] && !empty($person['workplaces']) && is_array($person['workplaces'])) {
                foreach ($person['workplaces'] as $wi => $workplace) {
                    if (!is_array($workplace)) {
                        continue;
                    }
                    [$lat, $lon] = self::extractCoordinates($workplace);
                    $street      = self::streetLine($workplace);
                    $zip         = self::zip($workplace);
                    $city        = self::city($workplace);
                    $faumap      = isset($workplace['faumap']) && is_string($workplace['faumap']) ? trim($workplace['faumap']) : '';

                    if (null === $lat || null === $lon) {
                        [$lat, $lon] = FauMapGeojson::resolveCoordinates(
                            $workplace,
                            '',
                            $street,
                            $zip,
                            $city,
                            $faumap
                        );
                    }

                    $room  = isset($workplace['room']) && is_string($workplace['room']) ? $workplace['room'] : '';
                    $floor = isset($workplace['floor']) && is_string($workplace['floor']) ? $workplace['floor'] : '';

                    if ($street === '' && $zip === '' && $city === '') {
                        continue;
                    }

                    $key = '__person__::' . (string) $wi;
                    $parts = array_filter([$street, trim($zip . ' ' . $city)]);
                    $formatted = implode(', ', $parts);
                    $places[$key] = [
                        'id'                => $key,
                        'contactIdentifier' => '',
                        'workplaceIndex'    => (int) $wi,
                        'label'             => $formatted,
                        'organizationName'  => '',
                        'organizationNumber' => '',
                        'room'              => $room,
                        'floor'             => $floor,
                        'street'            => $street,
                        'zip'               => $zip,
                        'city'              => $city,
                        'formattedAddress'  => $formatted,
                        'faumap'            => $faumap,
                        'latitude'          => $lat,
                        'longitude'         => $lon,
                    ];
                }
            }

            if ($places !== []) {
                $rows[] = [
                    'id'         => (int) $postId,
                    'label'      => $title,
                    'places'     => array_values($places),
                    'placesById' => $places,
                ];
            }
        }

        return [
            'error'   => false,
            'message' => '',
            'data'    => $rows,
        ];
    }

    /**
     * Find latitude/longitude in workplace data (supports nested geo/location payloads).
     *
     * @return array{0: ?float, 1: ?float}
     */
    public static function extractCoordinates(array $data): array
    {
        $pairs = [
            ['latitude', 'longitude'],
            ['Latitude', 'Longitude'],
            ['lat', 'lng'],
            ['lat', 'lon'],
            ['geo_latitude', 'geo_longitude'],
        ];

        foreach ($pairs as [$a, $b]) {
            if (isset($data[$a], $data[$b]) && is_numeric($data[$a]) && is_numeric($data[$b])) {
                return [(float) $data[$a], (float) $data[$b]];
            }
        }

        foreach ($data as $value) {
            if (!is_array($value)) {
                continue;
            }
            [$la, $lo] = self::extractCoordinates($value);
            if ($la !== null && $lo !== null) {
                return [$la, $lo];
            }
        }

        if (isset($data['geo']) && is_array($data['geo'])) {
            return self::extractCoordinates($data['geo']);
        }
        if (isset($data['location']) && is_array($data['location'])) {
            return self::extractCoordinates($data['location']);
        }

        return [null, null];
    }

    /** @param array<string,mixed> $w API workplace fragment */
    private static function streetLine(array $w): string
    {
        if (!empty($w['street']) && is_string($w['street'])) {
            return $w['street'];
        }

        return '';
    }

    /** @param array<string,mixed> $w API workplace fragment */
    private static function zip(array $w): string
    {
        if (!empty($w['postalCode']) && is_string($w['postalCode'])) {
            return $w['postalCode'];
        }
        if (!empty($w['zip']) && is_string($w['zip'])) {
            return $w['zip'];
        }

        return '';
    }

    /** @param array<string,mixed> $w API workplace fragment */
    private static function city(array $w): string
    {
        if (!empty($w['city']) && is_string($w['city'])) {
            return $w['city'];
        }
        if (!empty($w['addressLocality']) && is_string($w['addressLocality'])) {
            return $w['addressLocality'];
        }

        return '';
    }

    /**
     * FAU organisation number for karte.fau.de (API parameter “org”).
     *
     * @link https://karte.fau.de/api/doc
     *
     * @param array<string,mixed> $org Organization fragment from FAUdir contact JSON.
     */
    private static function organizationNumberFromOrg(array $org): string
    {
        if (isset($org['disambiguatingDescription']) && is_string($org['disambiguatingDescription'])) {
            $digits = preg_replace('/\D+/', '', $org['disambiguatingDescription']);

            return is_string($digits) && $digits !== '' && strlen($digits) <= 10 ? $digits : '';
        }

        if (isset($org['orgnr'])) {
            $raw = (is_string($org['orgnr']) || is_int($org['orgnr'])) ? (string) $org['orgnr'] : '';
            $raw = trim($raw);
            if ($raw !== '' && ctype_digit($raw) && strlen($raw) <= 10) {
                return $raw;
            }
        }

        return '';
    }
}
