import { __, sprintf } from '@wordpress/i18n';
import {
	PanelBody,
	SelectControl,
	TextControl,
} from '@wordpress/components';
import {
	InspectorControls,
	MediaUpload,
	MediaUploadCheck,
	RichText,
	useBlockProps,
} from '@wordpress/block-editor';
import { Fragment, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import apiFetch from '@wordpress/api-fetch';

const KARTE_HOST_SUFFIX = 'karte.fau.de';
const KARTE_IFRAME_PATH = '/api/v1/iframe';

function getPersonRows() {
	if (typeof window === 'undefined' || !window.rrze_directions) {
		return [];
	}

	const pkg = window.rrze_directions.persons;

	if (!pkg || pkg.error || !Array.isArray(pkg.data)) {
		return [];
	}

	return pkg.data;
}

function getEditorStrings() {
	return window.rrze_directions?.editorStrings ?? {};
}

function parseCoordinate(value) {
	if (value === null || value === undefined || `${value}`.trim() === '') {
		return null;
	}

	const normalized = `${value}`.trim().replace(',', '.');
	if (normalized === '' || Number.isNaN(Number(normalized))) {
		return null;
	}

	const parsed = Number(normalized);

	return Number.isFinite(parsed) ? parsed : null;
}

function buildAddressParam(street, zip, city) {
	const cityLine = [zip, city].filter(Boolean).join(' ').trim();
	const parts = [street.trim(), cityLine].filter(Boolean);

	return parts.join(',');
}

function isApiIframeUrl(url) {
	const trimmed = `${url ?? ''}`.trim();
	if (!trimmed) {
		return false;
	}

	try {
		const parsed = new URL(trimmed, 'https://karte.fau.de');
		const host = parsed.hostname.toLowerCase();
		const path = parsed.pathname;

		return host.endsWith(KARTE_HOST_SUFFIX) && path.includes(KARTE_IFRAME_PATH);
	} catch (error) {
		return false;
	}
}

function sanitizeOrganizationDigits(raw) {
	const digits = `${raw ?? ''}`.replace(/\D+/g, '');

	return digits.length > 0 && digits.length <= 10 ? digits : '';
}

function iframePathHasSegment(url, segment) {
	try {
		const path = new URL(url, `https://${KARTE_HOST_SUFFIX}`).pathname.toLowerCase();

		return path.split('/').includes(segment.toLowerCase());
	} catch (error) {
		return false;
	}
}

function buildCenterIframeUrl(latitude, longitude) {
	const pair = encodeURIComponent(`${latitude},${longitude}`);

	return `https://${KARTE_HOST_SUFFIX}${KARTE_IFRAME_PATH}/center/${pair}/zoom/16/`;
}

function needsAsyncIframeCanonicalization(url) {
	return isApiIframeUrl(url) && iframePathHasSegment(url, 'famos');
}

function sanitizeFamosDigits(raw) {
	const digits = `${raw ?? ''}`.replace(/\D+/g, '');

	return digits.length > 0 && digits.length <= 5 ? digits : '';
}

function famosFromIframeUrl(url) {
	const trimmed = `${url ?? ''}`.trim();
	if (!isApiIframeUrl(trimmed)) {
		return '';
	}

	try {
		const segments = new URL(trimmed, `https://${KARTE_HOST_SUFFIX}`).pathname
			.split('/')
			.filter(Boolean);

		for (let i = 0; i < segments.length - 1; i += 1) {
			if (segments[i].toLowerCase() !== 'famos') {
				continue;
			}

			return sanitizeFamosDigits(decodeURIComponent(segments[i + 1]));
		}
	} catch (error) {
		return '';
	}

	return '';
}

function iframeHasMarkerSegment(url) {
	return ['famos', 'org', 'address', 'term'].some((segment) =>
		iframePathHasSegment(url, segment)
	);
}

function buildFamosIframeUrl(famos) {
	return `https://${KARTE_HOST_SUFFIX}${KARTE_IFRAME_PATH}/famos/${encodeURIComponent(famos)}/`;
}

function buildOrgIframeUrl(org, attributes) {
	const addressQuery = buildAddressParam(
		attributes.addressStreet ?? '',
		attributes.addressZip ?? '',
		attributes.addressCity ?? ''
	);

	if (addressQuery) {
		return `https://${KARTE_HOST_SUFFIX}${KARTE_IFRAME_PATH}/org/${org}/address/${encodeURIComponent(addressQuery)}/`;
	}

	return `https://${KARTE_HOST_SUFFIX}${KARTE_IFRAME_PATH}/org/${org}/`;
}

function buildAddressIframeUrl(addressQuery) {
	return `https://${KARTE_HOST_SUFFIX}${KARTE_IFRAME_PATH}/address/${encodeURIComponent(addressQuery)}/`;
}

function isManualLocationMode(attributes) {
	return !Number(attributes.personId);
}

function resolveManualMapIframeSrc(attributes) {
	const mapUrl = `${attributes.mapUrl ?? ''}`.trim();

	if (mapUrl && isApiIframeUrl(mapUrl)) {
		return mapUrl;
	}

	const lat = parseCoordinate(attributes.mapLatitude);
	const lon = parseCoordinate(attributes.mapLongitude);
	if (lat !== null && lon !== null) {
		return buildCenterIframeUrl(lat, lon);
	}

	return '';
}

function resolveMapIframeSrc(attributes) {
	const mapUrl = `${attributes.mapUrl ?? ''}`.trim();

	if (mapUrl && isApiIframeUrl(mapUrl) && iframeHasMarkerSegment(mapUrl)) {
		return mapUrl;
	}

	const famos = famosFromIframeUrl(mapUrl);
	if (famos) {
		return buildFamosIframeUrl(famos);
	}

	if (isManualLocationMode(attributes)) {
		return resolveManualMapIframeSrc(attributes);
	}

	const org = sanitizeOrganizationDigits(attributes.organizationNumber);
	if (org) {
		return buildOrgIframeUrl(org, attributes);
	}

	const addressQuery = buildAddressParam(
		attributes.addressStreet ?? '',
		attributes.addressZip ?? '',
		attributes.addressCity ?? ''
	);
	if (addressQuery) {
		return buildAddressIframeUrl(addressQuery);
	}

	const lat = parseCoordinate(attributes.mapLatitude);
	const lon = parseCoordinate(attributes.mapLongitude);
	if (lat !== null && lon !== null) {
		return buildCenterIframeUrl(lat, lon);
	}

	if (mapUrl && isApiIframeUrl(mapUrl)) {
		return mapUrl;
	}

	return '';
}

function formatStreetLine(street, zip, city) {
	const cityLine = [zip, city].filter(Boolean).join(' ').trim();
	const parts = [street, cityLine].filter(Boolean);

	return parts.join(', ');
}

function normalizeAddress(value) {
	return `${value ?? ''}`
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ');
}

function shouldShowFormattedAddress(formatted, streetLine) {
	const trimmed = `${formatted ?? ''}`.trim();
	if (!trimmed) {
		return false;
	}

	if (!streetLine) {
		return true;
	}

	return normalizeAddress(trimmed) !== normalizeAddress(streetLine);
}

function formatCoordinatePair(latitude, longitude) {
	const formatValue = (value) => {
		const normalized = `${value}`.trim().replace(',', '.');
		if (!normalized.includes('.')) {
			return normalized;
		}

		return normalized.replace(/\.?0+$/, '');
	};

	return `${formatValue(latitude)}, ${formatValue(longitude)}`;
}

function googleMapsUrl(latitude, longitude) {
	const query = encodeURIComponent(`${latitude},${longitude}`);

	return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function appleMapsUrl(latitude, longitude) {
	const pair = `${latitude},${longitude}`;
	const encoded = encodeURIComponent(pair);

	return `https://maps.apple.com/?ll=${encoded}&q=${encoded}`;
}

async function fetchCoordinatesFromMapUrl(mapUrl) {
	const trimmed = `${mapUrl ?? ''}`.trim();
	if (!trimmed) {
		return { mapLatitude: '', mapLongitude: '' };
	}

	const path = window.rrze_directions?.restResolveCoordinatesPath;
	if (!path) {
		return { mapLatitude: '', mapLongitude: '' };
	}

	try {
		const res = await apiFetch({
			path,
			method: 'POST',
			data: { faumap: trimmed },
		});

		const la = res?.latitude;
		const lo = res?.longitude;

		if (
			la != null &&
			lo != null &&
			Number.isFinite(Number(la)) &&
			Number.isFinite(Number(lo))
		) {
			return { mapLatitude: String(la), mapLongitude: String(lo) };
		}
	} catch (error) {
		// Leave coordinates empty on failure.
	}

	return { mapLatitude: '', mapLongitude: '' };
}

async function fetchResolvedCoordinates(place) {
	if (!place) {
		return { mapLatitude: '', mapLongitude: '' };
	}

	const lat0 = parseCoordinate(place.latitude);
	const lon0 = parseCoordinate(place.longitude);
	if (lat0 !== null && lon0 !== null) {
		return { mapLatitude: String(lat0), mapLongitude: String(lon0) };
	}

	const path = window.rrze_directions?.restResolveCoordinatesPath;
	if (!path) {
		return { mapLatitude: '', mapLongitude: '' };
	}

	try {
		const res = await apiFetch({
			path,
			method: 'POST',
			data: {
				organizationNumber: place.organizationNumber ?? '',
				street: place.street ?? '',
				zip: place.zip ?? '',
				city: place.city ?? '',
				faumap: place.faumap ?? '',
				mapHints:
					place.mapHints && typeof place.mapHints === 'object'
						? place.mapHints
						: {},
			},
		});

		const la = res?.latitude;
		const lo = res?.longitude;

		if (
			la != null &&
			lo != null &&
			Number.isFinite(Number(la)) &&
			Number.isFinite(Number(lo))
		) {
			return { mapLatitude: String(la), mapLongitude: String(lo) };
		}
	} catch (error) {
		// Leave coordinates empty on failure.
	}

	return { mapLatitude: '', mapLongitude: '' };
}

async function fetchResolvedIframeSrc(candidateUrl) {
	const trimmed = `${candidateUrl ?? ''}`.trim();
	if (!trimmed || !isApiIframeUrl(trimmed)) {
		return { iframeSrc: '', mapUrl: '' };
	}

	const path = window.rrze_directions?.restResolveIframeSrcPath;
	if (!path) {
		return { iframeSrc: trimmed, mapUrl: trimmed };
	}

	try {
		const res = await apiFetch({
			path,
			method: 'POST',
			data: { url: trimmed },
		});

		const iframeSrc = `${res?.iframeSrc ?? ''}`.trim();
		const mapUrl = `${res?.mapUrl ?? iframeSrc}`.trim();

		if (iframeSrc && isApiIframeUrl(iframeSrc)) {
			return { iframeSrc, mapUrl };
		}
	} catch (error) {
		// Fall back to the candidate URL.
	}

	return { iframeSrc: trimmed, mapUrl: trimmed };
}

function hasResolvedCoordinates(coords) {
	return (
		parseCoordinate(coords?.mapLatitude) !== null &&
		parseCoordinate(coords?.mapLongitude) !== null
	);
}

async function loadWorkplaceCoordinates(place) {
	const coordDelays = [0, 600, 1500];
	let coords = { mapLatitude: '', mapLongitude: '' };

	for (const delay of coordDelays) {
		if (delay > 0) {
			await new Promise((resolve) => {
				window.setTimeout(resolve, delay);
			});
		}

		coords = await fetchResolvedCoordinates(place);
		if (hasResolvedCoordinates(coords)) {
			break;
		}
	}

	return coords;
}

function defaultHeadingForPerson(personName) {
	const base = __('Directions', 'rrze-directions');
	const name = `${personName ?? ''}`.trim();

	return name ? `${base} — ${name}` : base;
}

function clearPersonLinkAttributes() {
	return {
		personId: 0,
		personLabel: '',
		workplaceKey: '',
	};
}

async function resolvePersistedMapUrl(place, coords, currentMapUrl = '') {
	const trimmedFaumap = `${place.faumap ?? ''}`.trim();
	const candidateFromFaumap = trimmedFaumap || `${currentMapUrl ?? ''}`.trim();

	if (candidateFromFaumap && needsAsyncIframeCanonicalization(candidateFromFaumap)) {
		const resolved = await fetchResolvedIframeSrc(candidateFromFaumap);
		if (resolved.mapUrl) {
			return resolved.mapUrl;
		}
	}

	const candidate = resolveMapIframeSrc({
		mapUrl: candidateFromFaumap,
		organizationNumber: place.organizationNumber ?? '',
		mapLatitude: coords.mapLatitude,
		mapLongitude: coords.mapLongitude,
		addressStreet: place.street ?? '',
		addressZip: place.zip ?? '',
		addressCity: place.city ?? '',
	});

	return candidate || candidateFromFaumap;
}

function snapshotFromPlace(place) {
	return {
		workplaceKey: place.id ?? '',
		organizationName: place.organizationName ?? '',
		organizationNumber: place.organizationNumber ?? '',
		addressRoom: place.room ?? '',
		addressFloor: place.floor ?? '',
		addressStreet: place.street ?? '',
		addressZip: place.zip ?? '',
		addressCity: place.city ?? '',
		addressFormatted: place.formattedAddress ?? '',
		mapUrl: place.faumap ?? '',
		mapLatitude:
			place.latitude === null ||
			place.latitude === undefined ||
			`${place.latitude}`.trim() === ''
				? ''
				: String(place.latitude),
		mapLongitude:
			place.longitude === null ||
			place.longitude === undefined ||
			`${place.longitude}`.trim() === ''
				? ''
				: String(place.longitude),
	};
}


function CoordinateLinks({ latitude, longitude, strings, hideWhenMissing = false }) {
	const lat = parseCoordinate(latitude);
	const lon = parseCoordinate(longitude);

	if (lat === null || lon === null) {
		if (hideWhenMissing) {
			return null;
		}

		return (
			<div className="rrze-directions-editor__map-meta">
				<span className="rrze-directions-editor__muted">
					{strings.coordinatesMissing ??
						__('No coordinates detected in API data.', 'rrze-directions')}
				</span>
			</div>
		);
	}

	return (
		<>
			{formatCoordinatePair(latitude, longitude)}
			<br />
			<a href={googleMapsUrl(lat, lon)} target="_blank" rel="noopener noreferrer">
				{strings.googleMaps ?? __('Google Maps', 'rrze-directions')}
			</a>
			<span className="rrze-directions-editor__link-sep" aria-hidden="true">
				{' · '}
			</span>
			<a href={appleMapsUrl(lat, lon)} target="_blank" rel="noopener noreferrer">
				{strings.appleMaps ?? __('Apple Maps', 'rrze-directions')}
			</a>
		</>
	);
}

export default function Edit({ attributes, setAttributes }) {
	const {
		personId,
		personLabel,
		heading,
		workplaceKey,
		organizationName,
		organizationNumber,
		addressRoom,
		addressFloor,
		addressStreet,
		addressZip,
		addressCity,
		addressFormatted,
		mapUrl,
		mapLatitude,
		mapLongitude,
		mapImageId,
	} = attributes;

	const blockProps = useBlockProps({ className: 'rrze-directions-block' });
	const strings = getEditorStrings();
	const personRows = useMemo(() => getPersonRows(), []);

	const streetLine = formatStreetLine(addressStreet, addressZip, addressCity);
	const showFormattedAddress = shouldShowFormattedAddress(
		addressFormatted,
		streetLine
	);
	const mapIframeSrc = useMemo(
		() => resolveMapIframeSrc(attributes),
		[
			personId,
			mapUrl,
			organizationNumber,
			mapLatitude,
			mapLongitude,
			addressStreet,
			addressZip,
			addressCity,
		]
	);

	const imageDetails = useSelect(
		(select) => {
			if (!mapImageId) {
				return null;
			}

			return select(coreStore).getMedia(mapImageId, { context: 'view' });
		},
		[mapImageId]
	);

	const imageSrc =
		imageDetails?.media_details?.sizes?.medium?.source_url ??
		imageDetails?.source_url ??
		'';

	const personOptions = [{ label: strings.noneOption || '—', value: '' }].concat(
		personRows.map((row) => ({
			label: row.label ?? `#${row.id}`,
			value: String(row.id),
		}))
	);

	const selectedRow = personId
		? personRows.find((row) => row.id === Number(personId))
		: null;

	const workplaceOptions =
		selectedRow?.places?.map((p) => ({
			label: p.label ?? p.formattedAddress,
			value: p.id,
		})) ?? [];

	const wpSelectOptions = workplaceOptions;

	const displayHeading =
		`${heading ?? ''}`.trim() || defaultHeadingForPerson(selectedRow?.label ?? personLabel);

	const loadRequestIdRef = useRef(0);
	const mapUrlResolveRef = useRef(0);
	const [isLoadingDirections, setIsLoadingDirections] = useState(false);
	const [editorMapSrc, setEditorMapSrc] = useState('');

	useEffect(() => {
		if (!isLoadingDirections) {
			setEditorMapSrc(mapIframeSrc);
		}
	}, [isLoadingDirections, mapIframeSrc]);

	useEffect(() => {
		if (!personId || !personRows.length) {
			setIsLoadingDirections(false);
			return undefined;
		}

		const row = personRows.find((r) => r.id === Number(personId));
		if (!row?.places?.length) {
			setIsLoadingDirections(false);
			return undefined;
		}

		const id = workplaceKey || row.places[0]?.id;
		const place = id ? row.places.find((p) => p.id === id) : row.places[0];
		if (!place) {
			setIsLoadingDirections(false);
			return undefined;
		}

		const requestId = ++loadRequestIdRef.current;
		setIsLoadingDirections(true);

		(async () => {
			try {
				const { coords, dirs } = await loadWorkplaceData(place, {
					addressCity: place.city ?? addressCity ?? '',
					zip: place.zip ?? addressZip ?? '',
				});

				if (loadRequestIdRef.current !== requestId) {
					return;
				}

				const payload = {
					mapLatitude: coords.mapLatitude,
					mapLongitude: coords.mapLongitude,
				};

				if (!`${heading ?? ''}`.trim() && row.label) {
					payload.heading = defaultHeadingForPerson(row.label);
					payload.personLabel = row.label;
				}

				applyDirectionsPayload(payload, dirs);

				const nextMapUrl = await resolvePersistedMapUrl(place, coords, mapUrl);
				if (loadRequestIdRef.current !== requestId) {
					return;
				}

				if (nextMapUrl) {
					payload.mapUrl = nextMapUrl;
				}

				setAttributes(payload);
			} finally {
				if (loadRequestIdRef.current === requestId) {
					setIsLoadingDirections(false);
				}
			}
		})();

		return undefined;
	}, [personId, workplaceKey, personRows]);

	useEffect(() => {
		if (personId) {
			return undefined;
		}

		const url = `${mapUrl ?? ''}`.trim();
		if (!url) {
			return undefined;
		}

		const requestId = ++mapUrlResolveRef.current;

		(async () => {
			const coords = await fetchCoordinatesFromMapUrl(url);
			if (mapUrlResolveRef.current !== requestId) {
				return;
			}

			if (!hasResolvedCoordinates(coords)) {
				return;
			}

			if (
				coords.mapLatitude === mapLatitude &&
				coords.mapLongitude === mapLongitude
			) {
				return;
			}

			setAttributes({
				mapLatitude: coords.mapLatitude,
				mapLongitude: coords.mapLongitude,
			});
		})();

		return undefined;
	}, [mapUrl, personId]);

	useEffect(() => {
		if (personId) {
			return undefined;
		}

		const lat = parseCoordinate(mapLatitude);
		const lon = parseCoordinate(mapLongitude);
		if (lat === null || lon === null) {
			setIsLoadingDirections(false);
			return undefined;
		}

		const requestId = ++loadRequestIdRef.current;
		setIsLoadingDirections(true);

		(async () => {
			try {
				const { dirs } = await loadManualLocationData({
					mapLatitude,
					mapLongitude,
					addressCity,
					addressZip,
					addressStreet,
					addressFormatted,
				});

				if (loadRequestIdRef.current !== requestId) {
					return;
				}

				const payload = {};
				applyDirectionsPayload(payload, dirs);
				if (Object.keys(payload).length > 0) {
					setAttributes(payload);
				}
			} finally {
				if (loadRequestIdRef.current === requestId) {
					setIsLoadingDirections(false);
				}
			}
		})();

		return undefined;
	}, [
		personId,
		mapLatitude,
		mapLongitude,
		addressCity,
		addressZip,
		addressStreet,
		addressFormatted,
	]);

	const syncWorkplaceAttrs = (key) => {
		if (!selectedRow?.places?.length) {
			setAttributes({
				workplaceKey: '',
				organizationName: '',
				organizationNumber: '',
				addressRoom: '',
				addressFloor: '',
				addressStreet: '',
				addressZip: '',
				addressCity: '',
				addressFormatted: '',
				mapUrl: '',
				mapLatitude: '',
				mapLongitude: '',
				directionsBike: '',
				directionsCar: '',
				directionsTransit: '',
				directionsBikeRoute: '',
				directionsCarRoute: '',
				directionsTransitRoute: '',
			});
			return;
		}

		const place =
			(key && selectedRow.places.find((p) => p.id === key)) ||
			selectedRow.places[0];

		setAttributes({
			...snapshotFromPlace(place),
			workplaceKey: place.id ?? '',
		});
	};

	const mapIllustration = (
		<p className="rrze-directions-block__media">
			{mapImageId && imageSrc ? (
				<Fragment>
					<img alt="" src={imageSrc} className="rrze-directions-block__img" />

					<MediaUploadCheck>
						<MediaUpload
							onSelect={(media) =>
								setAttributes({
									mapImageId: media?.id ? Number(media.id) : 0,
								})
							}
							value={mapImageId}
							allowedTypes={['image']}
							render={({ open }) => (
								<button
									className="components-button is-secondary is-small"
									type="button"
									onClick={open}
								>
									{strings.replaceIllustration ??
										__('Replace illustration', 'rrze-directions')}
								</button>
							)}
						/>
						<button
							type="button"
							className="components-button is-link is-destructive is-small"
							onClick={() => setAttributes({ mapImageId: 0 })}
						>
							{strings.removeIllustration ??
								__('Remove illustration', 'rrze-directions')}
						</button>
					</MediaUploadCheck>
				</Fragment>
			) : (
				<MediaUploadCheck>
					<MediaUpload
						onSelect={(media) =>
							setAttributes({
								mapImageId: media?.id ? Number(media.id) : 0,
							})
						}
						value={0}
						allowedTypes={['image']}
						render={({ open }) => (
							<button
								className="components-button is-primary"
								type="button"
								onClick={open}
							>
								{strings.mapImageLabel ??
									__('Illustration', 'rrze-directions')}
							</button>
						)}
					/>
				</MediaUploadCheck>
			)}
		</p>
	);

	return (
		<Fragment>
			<InspectorControls>
				<PanelBody title={strings.selectPersonPanel ?? __('FAUdir', 'rrze-directions')}>
					<SelectControl
						label={strings.selectPerson ?? __('Person', 'rrze-directions')}
						value={personId ? String(personId) : ''}
						options={personOptions}
						onChange={(next) => {
							const nextId = Number(next) || 0;
							const row = nextId ? personRows.find((r) => r.id === nextId) : null;
							const nextHeading =
								row?.label && !`${heading ?? ''}`.trim()
									? defaultHeadingForPerson(row.label)
									: heading;

							if (!row?.places?.length) {
								setAttributes({
									...clearPersonLinkAttributes(),
									personId: nextId,
									personLabel: row?.label ?? '',
									heading: nextHeading,
									mapImageId: 0,
									organizationName: '',
									organizationNumber: '',
									addressRoom: '',
									addressFloor: '',
									addressStreet: '',
									addressZip: '',
									addressCity: '',
									addressFormatted: '',
									mapUrl: '',
									mapLatitude: '',
									mapLongitude: '',
									directionsBike: '',
									directionsCar: '',
									directionsTransit: '',
									directionsBikeRoute: '',
									directionsCarRoute: '',
									directionsTransitRoute: '',
								});
								return;
							}

							const snapshot = snapshotFromPlace(row.places[0]);

							setAttributes({
								personId: nextId,
								personLabel: row.label ?? '',
								heading: nextHeading,
								mapImageId: 0,
								workplaceKey: snapshot.workplaceKey,
								organizationName: snapshot.organizationName,
								organizationNumber: snapshot.organizationNumber,
								addressRoom: snapshot.addressRoom,
								addressFloor: snapshot.addressFloor,
								addressStreet: snapshot.addressStreet,
								addressZip: snapshot.addressZip,
								addressCity: snapshot.addressCity,
								addressFormatted: snapshot.addressFormatted,
								mapUrl: snapshot.mapUrl,
								mapLatitude: snapshot.mapLatitude,
								mapLongitude: snapshot.mapLongitude,
							});
						}}
					/>

					{Boolean(personId) && wpSelectOptions.length > 0 ? (
						<SelectControl
							label={
								strings.selectWorkplace ??
								__('Office / workplace', 'rrze-directions')
							}
							value={workplaceKey || selectedRow?.places?.[0]?.id || ''}
							options={wpSelectOptions}
							onChange={(key) => syncWorkplaceAttrs(key)}
						/>
					) : null}
				</PanelBody>

				<PanelBody title={strings.mapSection ?? __('Map', 'rrze-directions')}>
					<TextControl
						label={
							<>
								{strings.mapUrl ?? __('Link to', 'rrze-directions')}{' '}
								<a
									href="https://karte.fau.de/"
									target="_blank"
									rel="noopener noreferrer"
								>
									karte.fau.de
								</a>
							</>
						}
						value={mapUrl}
						onChange={(next) =>
							setAttributes({
								mapUrl: next,
								...clearPersonLinkAttributes(),
							})
						}
					/>
					<TextControl
						label={strings.mapLatitudeLabel ?? __('Latitude', 'rrze-directions')}
						value={mapLatitude}
						onChange={(next) =>
							setAttributes({
								mapLatitude: next,
								mapUrl: '',
								...clearPersonLinkAttributes(),
							})
						}
						help={__(
							'Decimal degrees, e.g. 49.4550',
							'rrze-directions'
						)}
					/>
					<TextControl
						label={strings.mapLongitudeLabel ?? __('Longitude', 'rrze-directions')}
						value={mapLongitude}
						onChange={(next) =>
							setAttributes({
								mapLongitude: next,
								mapUrl: '',
								...clearPersonLinkAttributes(),
							})
						}
						help={__(
							'Decimal degrees, e.g. 11.0770',
							'rrze-directions'
						)}
					/>
					<div className="rrze-directions-editor__map-meta">
						<CoordinateLinks
							latitude={mapLatitude}
							longitude={mapLongitude}
							strings={strings}
						/>
					</div>
					<br />

					{mapIllustration}
				</PanelBody>

				<PanelBody
					title={
						strings.directionsSettings ??
						__('Arrival directions', 'rrze-directions')
					}
					initialOpen
				>
					<ToggleControl
						label={
							strings.showDirectionsBike ??
							__('Show walking / cycling', 'rrze-directions')
						}
						checked={showDirectionsBike !== false}
						onChange={(next) =>
							setAttributes({ showDirectionsBike: next })
						}
					/>
					<ToggleControl
						label={
							strings.showDirectionsCar ??
							__('Show by car', 'rrze-directions')
						}
						checked={showDirectionsCar !== false}
						onChange={(next) => setAttributes({ showDirectionsCar: next })}
					/>
					<ToggleControl
						label={
							strings.showDirectionsTransit ??
							__('Show bus / train', 'rrze-directions')
						}
						checked={showDirectionsTransit !== false}
						onChange={(next) =>
							setAttributes({ showDirectionsTransit: next })
						}
					/>
					<SelectControl
						label={
							strings.directionsLayout ??
							__('Layout', 'rrze-directions')
						}
						value={normalizeDirectionsLayout(directionsLayout)}
						options={[
							{
								label:
									strings.directionsLayoutPills ??
									__('Pills', 'rrze-directions'),
								value: 'pills',
							},
							{
								label:
									strings.directionsLayoutAccordion ??
									__('Accordion', 'rrze-directions'),
								value: 'accordion',
							},
							{
								label:
									strings.directionsLayoutColumns ??
									__('Columns', 'rrze-directions'),
								value: 'columns',
							},
							{
								label:
									strings.directionsLayoutTabs ??
									__('Tabs', 'rrze-directions'),
								value: 'tabs',
							},
							{
								label:
									strings.directionsLayoutDropdown ??
									__('Dropdown', 'rrze-directions'),
								value: 'dropdown',
							},
						]}
						onChange={(next) =>
							setAttributes({
								directionsLayout: normalizeDirectionsLayout(next),
							})
						}
					/>
				</PanelBody>
			</InspectorControls>

			<div {...blockProps}>
				<div className="rrze-directions-editor">
					<RichText
						tagName="h3"
						className="rrze-directions-editor__title"
						value={heading}
						onChange={(next) => setAttributes({ heading: next })}
						placeholder={displayHeading}
						allowedFormats={[]}
					/>

					<section>
						<address className="rrze-directions-editor__address">
							{organizationName ? (
								<span className="rrze-directions-editor__line">
									{organizationName}
									<br />
								</span>
							) : null}
							{addressRoom ? (
								<span className="rrze-directions-editor__line">
									{sprintf(
										/* translators: %s: room number */
										strings.roomLabel ?? __('Room: %s', 'rrze-directions'),
										addressRoom
									)}
									<br />
								</span>
							) : null}
							{addressFloor ? (
								<span className="rrze-directions-editor__line">
									{sprintf(
										/* translators: %s: floor */
										strings.floorLabel ?? __('Floor: %s', 'rrze-directions'),
										addressFloor
									)}
									<br />
								</span>
							) : null}
							{streetLine ? (
								<span className="rrze-directions-editor__line">
									{streetLine}
									<br />
								</span>
							) : showFormattedAddress ? (
								<span className="rrze-directions-editor__line">
									{addressFormatted}
									<br />
								</span>
							) : null}
							{showFormattedAddress && streetLine ? (
								<span className="rrze-directions-editor__meta">
									{addressFormatted}
								</span>
							) : null}
							{!personId ||
							(!streetLine && !showFormattedAddress && !organizationName) ? (
								<span className="rrze-directions-editor__muted">
									{strings.selectPersonWorkplace ??
										__('Select person and workplace.', 'rrze-directions')}
								</span>
							) : null}
							{mapLatitude && mapLongitude ? (
								<>
									<br />
									<CoordinateLinks
										latitude={mapLatitude}
										longitude={mapLongitude}
										strings={strings}
										hideWhenMissing
									/>
								</>
							) : null}
						</address>
					</section>

					<section className="rrze-directions-editor__map">
						{isLoadingDirections ? (
							<p className="rrze-directions-editor__loading" aria-live="polite">
								{strings.mapLoading ??
									__('Loading map…', 'rrze-directions')}
							</p>
						) : editorMapSrc ? (
							<div className="rrze-directions__map-frame">
								<iframe
									title={
										strings.mapServiceTitle ??
										__('FAU map service', 'rrze-directions')
									}
									src={editorMapSrc}
									className="rrze-directions__iframe"
									loading="lazy"
									referrerPolicy="no-referrer-when-downgrade"
								/>
							</div>
						) : (
							<p className="rrze-directions-editor__muted">
								{strings.mapUnavailable ??
									__(
										'No map parameters available (add FAUdir data or a Map URL).',
										'rrze-directions'
									)}
							</p>
						)}
					</section>

					<section>
						{showDirectionsBike !== false ? (
							<>
								<h4>
									{strings.directionsBike ??
										__('Walking / Cycling', 'rrze-directions')}
								</h4>
								<RouteVariantsEditorMaps
									routeJson={directionsBikeRoute}
									strings={strings}
								/>
								<RichText
									tagName="div"
									className="rrze-directions-editor__richtext"
									value={directionsBike}
									onChange={(value) =>
										setAttributes({ directionsBike: value })
									}
									allowedFormats={['core/bold', 'core/italic', 'core/link']}
									placeholder={
										strings.directionsBikePlaceholder ??
										__('Directions by foot / bike.', 'rrze-directions')
									}
								/>
							</>
						) : null}

						{showDirectionsCar !== false ? (
							<>
								<h4>
									{strings.directionsCar ?? __('By car', 'rrze-directions')}
								</h4>
								<RouteVariantsEditorMaps
									routeJson={directionsCarRoute}
									strings={strings}
								/>
								<RichText
									tagName="div"
									className="rrze-directions-editor__richtext"
									value={directionsCar}
									onChange={(value) => setAttributes({ directionsCar: value })}
									allowedFormats={['core/bold', 'core/italic', 'core/link']}
									placeholder={
										strings.directionsCarPlaceholder ??
										__('Directions by car.', 'rrze-directions')
									}
								/>
							</>
						) : null}

						{showDirectionsTransit !== false ? (
							<>
								<h4>
									{strings.directionsTransit ??
										__('Bus / train', 'rrze-directions')}
								</h4>
								<RouteVariantsEditorMaps
									routeJson={directionsTransitRoute}
									strings={strings}
								/>
								<RichText
									tagName="div"
									className="rrze-directions-editor__richtext"
									value={directionsTransit}
									onChange={(value) =>
										setAttributes({ directionsTransit: value })
									}
									allowedFormats={['core/bold', 'core/italic', 'core/link']}
									placeholder={
										strings.directionsTransitPlaceholder ??
										__('Public transport.', 'rrze-directions')
									}
								/>
							</>
						) : null}

						{isLoadingDirections ? (
							<p className="rrze-directions-editor__loading" aria-live="polite">
								{strings.directionsLoading ??
									__('Loading directions…', 'rrze-directions')}
							</p>
						) : null}

						<DirectionsEditorPreview attributes={attributes} strings={strings} />
					</section>
				</div>
			</div>
		</Fragment>
	);
}
