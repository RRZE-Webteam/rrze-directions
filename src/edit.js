import { __, sprintf } from '@wordpress/i18n';
import {
	PanelBody,
	SelectControl,
	TextControl,
	ToggleControl,
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
	if (typeof window === 'undefined' || !window.rrze_direction) {
		return [];
	}

	const pkg = window.rrze_direction.persons;

	if (!pkg || pkg.error || !Array.isArray(pkg.data)) {
		return [];
	}

	return pkg.data;
}

function getEditorStrings() {
	return window.rrze_direction?.editorStrings ?? {};
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

function resolveMapIframeSrc(attributes) {
	const mapUrl = `${attributes.mapUrl ?? ''}`.trim();

	if (mapUrl && isApiIframeUrl(mapUrl) && iframeHasMarkerSegment(mapUrl)) {
		return mapUrl;
	}

	const famos = famosFromIframeUrl(mapUrl);
	if (famos) {
		return buildFamosIframeUrl(famos);
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

async function fetchResolvedCoordinates(place) {
	if (!place) {
		return { mapLatitude: '', mapLongitude: '' };
	}

	const lat0 = parseCoordinate(place.latitude);
	const lon0 = parseCoordinate(place.longitude);
	if (lat0 !== null && lon0 !== null) {
		return { mapLatitude: String(lat0), mapLongitude: String(lon0) };
	}

	const path = window.rrze_direction?.restResolveCoordinatesPath;
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

	const path = window.rrze_direction?.restResolveIframeSrcPath;
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

async function fetchOpenRouteDirections(place, coords, extras = {}) {
	const path = window.rrze_direction?.restOpenRouteDirectionsPath;
	if (!path) {
		return null;
	}

	const lat =
		parseCoordinate(coords.mapLatitude) ?? parseCoordinate(place.latitude);
	const lon =
		parseCoordinate(coords.mapLongitude) ?? parseCoordinate(place.longitude);
	const city =
		`${place.city ?? ''}`.trim() ||
		`${extras.addressCity ?? ''}`.trim();
	const zip =
		`${place.zip ?? ''}`.trim() || `${extras.zip ?? ''}`.trim();
	const street = `${place.street ?? ''}`.trim();
	const formattedAddress = `${place.formattedAddress ?? ''}`.trim();

	if (lat === null || lon === null || (!city && !zip)) {
		return null;
	}

	try {
		return await apiFetch({
			path,
			method: 'POST',
			data: {
				latitude: lat,
				longitude: lon,
				city,
				zip,
				street,
				formattedAddress,
			},
		});
	} catch (error) {
		return null;
	}
}

function directionsResponseHasContent(dirs) {
	if (!dirs) {
		return false;
	}

	return ['directionBike', 'directionCar', 'directionTransit'].some((key) =>
		hasDirectionContent(dirs[key])
	);
}

function hasResolvedCoordinates(coords) {
	return (
		parseCoordinate(coords?.mapLatitude) !== null &&
		parseCoordinate(coords?.mapLongitude) !== null
	);
}

async function loadWorkplaceData(place, extras = {}) {
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

	if (!hasResolvedCoordinates(coords)) {
		return { coords, dirs: null };
	}

	const dirDelays = [0, 1000, 2500];
	let dirs = null;

	for (const delay of dirDelays) {
		if (delay > 0) {
			await new Promise((resolve) => {
				window.setTimeout(resolve, delay);
			});
		}

		dirs = await fetchOpenRouteDirections(place, coords, extras);
		if (directionsResponseHasContent(dirs)) {
			break;
		}
	}

	return { coords, dirs };
}

function applyDirectionPayload(payload, dirs) {
	if (!dirs || !directionsResponseHasContent(dirs)) {
		return;
	}

	payload.directionBike = dirs.directionBike ?? '';
	payload.directionCar = dirs.directionCar ?? '';
	payload.directionTransit = dirs.directionTransit ?? '';
	payload.directionBikeRoute = dirs.directionBikeRoute ?? '';
	payload.directionCarRoute = dirs.directionCarRoute ?? '';
	payload.directionTransitRoute = dirs.directionTransitRoute ?? '';
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

function hasDirectionContent(html) {
	return `${html ?? ''}`.replace(/<[^>]*>/g, '').trim() !== '';
}

function hasRouteData(routeJson) {
	if (!routeJson) {
		return false;
	}

	try {
		const data = JSON.parse(routeJson);
		return (
			Array.isArray(data?.coordinates) &&
			data.coordinates.length > 1 &&
			Array.isArray(data?.steps) &&
			data.steps.length > 0
		);
	} catch (error) {
		return false;
	}
}

function getVisibleDirectionSections(attributes, strings) {
	const sections = [
		{
			key: 'bike',
			enabled: attributes.showDirectionBike !== false,
			content: attributes.directionBike,
			route: attributes.directionBikeRoute,
			title: strings.directionBike ?? __('Walking / Cycling', 'rrze-direction'),
			placeholder:
				strings.directionBikePlaceholder ??
				__('Directions by foot / bike.', 'rrze-direction'),
		},
		{
			key: 'car',
			enabled: attributes.showDirectionCar !== false,
			content: attributes.directionCar,
			route: attributes.directionCarRoute,
			title: strings.directionCar ?? __('By car', 'rrze-direction'),
			placeholder:
				strings.directionCarPlaceholder ??
				__('Directions by car.', 'rrze-direction'),
		},
		{
			key: 'transit',
			enabled: attributes.showDirectionTransit !== false,
			content: attributes.directionTransit,
			route: attributes.directionTransitRoute,
			title: strings.directionTransit ?? __('Bus / train', 'rrze-direction'),
			placeholder:
				strings.directionTransitPlaceholder ??
				__('Public transport.', 'rrze-direction'),
		},
	];

	return sections.filter(
		(section) => section.enabled && hasDirectionContent(section.content)
	);
}

function normalizeDirectionsLayout(layout) {
	if (layout === 'columns' || layout === 'tabs') {
		return layout;
	}

	return 'accordion';
}

function DirectionSectionPreviewBody({ section, strings }) {
	return (
		<>
			<RouteMapEditorPlaceholder
				routeJson={section.route}
				title={strings.routeMapTitle ?? __('Route map', 'rrze-direction')}
				hint={
					strings.routeMapPreview ??
					__(
						'Interactive route map with numbered steps is shown on the published page.',
						'rrze-direction'
					)
				}
			/>
			<div
				className="rrze-direction__rte"
				dangerouslySetInnerHTML={{ __html: section.content }}
			/>
		</>
	);
}

function RouteMapEditorPlaceholder({ routeJson, title, hint }) {
	if (!hasRouteData(routeJson)) {
		return null;
	}

	const previewHint =
		hint ??
		__(
			'Interactive route map with numbered steps is shown on the published page.',
			'rrze-direction'
		);

	return (
		<div className="rrze-direction-route-map rrze-direction-route-map--editor-placeholder">
			{title ? (
				<h4 className="rrze-direction-route-map__title">{title}</h4>
			) : null}
			<div className="rrze-direction-route-map__preview" aria-hidden="true">
				<svg
					className="rrze-direction-route-map__preview-svg"
					viewBox="0 0 640 360"
					xmlns="http://www.w3.org/2000/svg"
					preserveAspectRatio="xMidYMid slice"
					role="presentation"
				>
					<rect width="640" height="360" fill="#e8eef4" />
					<path
						d="M0 72h640M0 144h640M0 216h640M0 288h640M128 0v360M256 0v360M384 0v360M512 0v360"
						stroke="#d0dae6"
						strokeWidth="2"
					/>
					<path
						d="M96 248 C180 220, 220 120, 320 108 S460 72, 544 92"
						fill="none"
						stroke="#04316a"
						strokeWidth="10"
						strokeLinecap="round"
					/>
					<circle cx="96" cy="248" r="18" fill="#04316a" stroke="#fff" strokeWidth="4" />
					<text x="96" y="254" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700">
						1
					</text>
					<circle cx="320" cy="108" r="18" fill="#04316a" stroke="#fff" strokeWidth="4" />
					<text x="320" y="114" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700">
						2
					</text>
					<circle cx="544" cy="92" r="18" fill="#04316a" stroke="#fff" strokeWidth="4" />
					<text x="544" y="98" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700">
						3
					</text>
				</svg>
			</div>
			<p className="rrze-direction-route-map__hint">{previewHint}</p>
		</div>
	);
}

function DirectionsEditorPreview({ attributes, strings }) {
	const layout = normalizeDirectionsLayout(attributes.directionsLayout);
	const sections = getVisibleDirectionSections(attributes, strings);
	const [activeKey, setActiveKey] = useState(sections[0]?.key ?? '');

	useEffect(() => {
		if (!sections.some((section) => section.key === activeKey)) {
			setActiveKey(sections[0]?.key ?? '');
		}
	}, [sections, activeKey]);

	if (sections.length === 0) {
		return null;
	}

	const layoutLabel =
		layout === 'columns'
			? strings.directionsLayoutColumns ?? __('Columns', 'rrze-direction')
			: layout === 'tabs'
				? strings.directionsLayoutTabs ?? __('Tabs', 'rrze-direction')
				: strings.directionsLayoutAccordion ?? __('Accordion', 'rrze-direction');

	let preview = null;

	if (layout === 'accordion') {
		preview = (
			<div className="rrze-direction__directions rrze-direction__accordions">
				<div className="rrze-direction__accordion">
					{sections.map((section, index) => (
						<div
							key={section.key}
							className="rrze-direction__accordion-item"
						>
							<div className="rrze-direction__accordion-group">
								<h3 className="rrze-direction__accordion-heading">
									<button
										type="button"
										className={
											index === 0
												? 'rrze-direction__accordion-toggle active'
												: 'rrze-direction__accordion-toggle'
										}
										aria-expanded={index === 0}
									>
										{section.title}
									</button>
								</h3>
								<div
									className={
										index === 0
											? 'rrze-direction__accordion-panel open'
											: 'rrze-direction__accordion-panel'
									}
									role="region"
									hidden={index !== 0 ? true : undefined}
								>
									<div className="rrze-direction__accordion-inner clearfix">
										<DirectionSectionPreviewBody
											section={section}
											strings={strings}
										/>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		);
	} else if (layout === 'tabs') {
		const activeIndex = Math.max(
			0,
			sections.findIndex((section) => section.key === activeKey)
		);

		preview = (
			<div className="rrze-direction__directions">
				<div className="rrze-elements-tabs primary">
					<div role="tablist" className="manual">
						{sections.map((section, index) => (
							<button
								key={section.key}
								type="button"
								role="tab"
								aria-selected={index === activeIndex}
								onClick={() => setActiveKey(section.key)}
							>
								<span className="focus" tabIndex={-1}>
									{section.title}
								</span>
							</button>
						))}
					</div>
					{sections.map((section, index) => (
						<div
							key={section.key}
							role="tabpanel"
							className={index !== activeIndex ? 'is-hidden' : undefined}
						>
							<DirectionSectionPreviewBody
								section={section}
								strings={strings}
							/>
						</div>
					))}
				</div>
			</div>
		);
	} else {
		preview = (
			<div
				className={`rrze-direction__directions rrze-direction__directions-grid rrze-direction__directions-grid--cols-${
					sections.length >= 3 ? 3 : sections.length
				}`}
			>
				{sections.map((section) => (
					<section
						key={section.key}
						className="rrze-direction__text rrze-direction__text--column"
					>
						<h3>{section.title}</h3>
						<DirectionSectionPreviewBody
							section={section}
							strings={strings}
						/>
					</section>
				))}
			</div>
		);
	}

	return (
		<div className="rrze-direction-editor__directions-preview">
			<p className="rrze-direction-editor__directions-preview-label">
				{layoutLabel}
			</p>
			{preview}
		</div>
	);
}

function CoordinateLinks({ latitude, longitude, strings, hideWhenMissing = false }) {
	const lat = parseCoordinate(latitude);
	const lon = parseCoordinate(longitude);

	if (lat === null || lon === null) {
		if (hideWhenMissing) {
			return null;
		}

		return (
			<div className="rrze-direction-editor__map-meta">
				<span className="rrze-direction-editor__muted">
					{strings.coordinatesMissing ??
						__('No coordinates detected in API data.', 'rrze-direction')}
				</span>
			</div>
		);
	}

	return (
		<>
			{formatCoordinatePair(latitude, longitude)}
			<br />
			<a href={googleMapsUrl(lat, lon)} target="_blank" rel="noopener noreferrer">
				{strings.googleMaps ?? __('Google Maps', 'rrze-direction')}
			</a>
			<span className="rrze-direction-editor__link-sep" aria-hidden="true">
				{' · '}
			</span>
			<a href={appleMapsUrl(lat, lon)} target="_blank" rel="noopener noreferrer">
				{strings.appleMaps ?? __('Apple Maps', 'rrze-direction')}
			</a>
		</>
	);
}

export default function Edit({ attributes, setAttributes }) {
	const {
		personId,
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
		directionBike,
		directionCar,
		directionTransit,
		directionBikeRoute,
		directionCarRoute,
		directionTransitRoute,
		showDirectionBike,
		showDirectionCar,
		showDirectionTransit,
		directionsLayout,
	} = attributes;

	const blockProps = useBlockProps({ className: 'rrze-direction-block' });
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

	const previewPersonLabel =
		selectedRow?.label ?? __('Directions', 'rrze-direction');

	const loadRequestIdRef = useRef(0);
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

				applyDirectionPayload(payload, dirs);

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
				directionBike: '',
				directionCar: '',
				directionTransit: '',
				directionBikeRoute: '',
				directionCarRoute: '',
				directionTransitRoute: '',
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
		<p className="rrze-direction-block__media">
			{mapImageId && imageSrc ? (
				<Fragment>
					<img alt="" src={imageSrc} className="rrze-direction-block__img" />

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
										__('Replace illustration', 'rrze-direction')}
								</button>
							)}
						/>
						<button
							type="button"
							className="components-button is-link is-destructive is-small"
							onClick={() => setAttributes({ mapImageId: 0 })}
						>
							{strings.removeIllustration ??
								__('Remove illustration', 'rrze-direction')}
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
									__('Illustration', 'rrze-direction')}
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
				<PanelBody title={strings.selectPersonPanel ?? __('FAUdir', 'rrze-direction')}>
					<SelectControl
						label={strings.selectPerson ?? __('Person', 'rrze-direction')}
						value={personId ? String(personId) : ''}
						options={personOptions}
						onChange={(next) => {
							const nextId = Number(next) || 0;
							const row = nextId ? personRows.find((r) => r.id === nextId) : null;

							if (!row?.places?.length) {
								setAttributes({
									personId: nextId,
									mapImageId: 0,
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
									directionBike: '',
									directionCar: '',
									directionTransit: '',
									directionBikeRoute: '',
									directionCarRoute: '',
									directionTransitRoute: '',
								});
								return;
							}

							const snapshot = snapshotFromPlace(row.places[0]);

							setAttributes({
								personId: nextId,
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
								__('Office / workplace', 'rrze-direction')
							}
							value={workplaceKey || selectedRow?.places?.[0]?.id || ''}
							options={wpSelectOptions}
							onChange={(key) => syncWorkplaceAttrs(key)}
						/>
					) : null}
				</PanelBody>

				<PanelBody title={strings.mapSection ?? __('Map', 'rrze-direction')}>
					<TextControl
						label={
							<>
								{strings.mapUrl ?? __('Link to', 'rrze-direction')}{' '}
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
						onChange={(next) => setAttributes({ mapUrl: next })}
					/>
					<div className="rrze-direction-editor__map-meta">
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
						__('Arrival directions', 'rrze-direction')
					}
					initialOpen
				>
					<ToggleControl
						label={
							strings.showDirectionBike ??
							__('Show walking / cycling', 'rrze-direction')
						}
						checked={showDirectionBike !== false}
						onChange={(next) =>
							setAttributes({ showDirectionBike: next })
						}
					/>
					<ToggleControl
						label={
							strings.showDirectionCar ??
							__('Show by car', 'rrze-direction')
						}
						checked={showDirectionCar !== false}
						onChange={(next) => setAttributes({ showDirectionCar: next })}
					/>
					<ToggleControl
						label={
							strings.showDirectionTransit ??
							__('Show bus / train', 'rrze-direction')
						}
						checked={showDirectionTransit !== false}
						onChange={(next) =>
							setAttributes({ showDirectionTransit: next })
						}
					/>
					<SelectControl
						label={
							strings.directionsLayout ??
							__('Layout', 'rrze-direction')
						}
						value={normalizeDirectionsLayout(directionsLayout)}
						options={[
							{
								label:
									strings.directionsLayoutAccordion ??
									__('Accordion', 'rrze-direction'),
								value: 'accordion',
							},
							{
								label:
									strings.directionsLayoutColumns ??
									__('Columns', 'rrze-direction'),
								value: 'columns',
							},
							{
								label:
									strings.directionsLayoutTabs ??
									__('Tabs', 'rrze-direction'),
								value: 'tabs',
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
				<div className="rrze-direction-editor">
					<h3 className="rrze-direction-editor__title">
						{__('Directions', 'rrze-direction')}
						{personId ? ` — ${previewPersonLabel}` : ''}
					</h3>

					<section>
						<address className="rrze-direction-editor__address">
							{organizationName ? (
								<span className="rrze-direction-editor__line">
									{organizationName}
									<br />
								</span>
							) : null}
							{addressRoom ? (
								<span className="rrze-direction-editor__line">
									{sprintf(
										/* translators: %s: room number */
										strings.roomLabel ?? __('Room: %s', 'rrze-direction'),
										addressRoom
									)}
									<br />
								</span>
							) : null}
							{addressFloor ? (
								<span className="rrze-direction-editor__line">
									{sprintf(
										/* translators: %s: floor */
										strings.floorLabel ?? __('Floor: %s', 'rrze-direction'),
										addressFloor
									)}
									<br />
								</span>
							) : null}
							{streetLine ? (
								<span className="rrze-direction-editor__line">
									{streetLine}
									<br />
								</span>
							) : showFormattedAddress ? (
								<span className="rrze-direction-editor__line">
									{addressFormatted}
									<br />
								</span>
							) : null}
							{showFormattedAddress && streetLine ? (
								<span className="rrze-direction-editor__meta">
									{addressFormatted}
								</span>
							) : null}
							{!personId ||
							(!streetLine && !showFormattedAddress && !organizationName) ? (
								<span className="rrze-direction-editor__muted">
									{strings.selectPersonWorkplace ??
										__('Select person and workplace.', 'rrze-direction')}
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

					<section className="rrze-direction-editor__map">
						{isLoadingDirections ? (
							<p className="rrze-direction-editor__loading" aria-live="polite">
								{strings.mapLoading ??
									__('Loading map…', 'rrze-direction')}
							</p>
						) : editorMapSrc ? (
							<div className="rrze-direction__map-frame">
								<iframe
									title={
										strings.mapServiceTitle ??
										__('FAU map service', 'rrze-direction')
									}
									src={editorMapSrc}
									className="rrze-direction__iframe"
									loading="lazy"
									referrerPolicy="no-referrer-when-downgrade"
								/>
							</div>
						) : (
							<p className="rrze-direction-editor__muted">
								{strings.mapUnavailable ??
									__(
										'No map parameters available (add FAUdir data or a Map URL).',
										'rrze-direction'
									)}
							</p>
						)}
					</section>

					<section>
						{showDirectionBike !== false ? (
							<>
								<h4>
									{strings.directionBike ??
										__('Walking / Cycling', 'rrze-direction')}
								</h4>
								<RouteMapEditorPlaceholder
									routeJson={directionBikeRoute}
									title={strings.routeMapTitle ?? __('Route map', 'rrze-direction')}
								/>
								<RichText
									tagName="div"
									className="rrze-direction-editor__richtext"
									value={directionBike}
									onChange={(value) =>
										setAttributes({ directionBike: value })
									}
									allowedFormats={['core/bold', 'core/italic', 'core/link']}
									placeholder={
										strings.directionBikePlaceholder ??
										__('Directions by foot / bike.', 'rrze-direction')
									}
								/>
							</>
						) : null}

						{showDirectionCar !== false ? (
							<>
								<h4>
									{strings.directionCar ?? __('By car', 'rrze-direction')}
								</h4>
								<RouteMapEditorPlaceholder
									routeJson={directionCarRoute}
									title={strings.routeMapTitle ?? __('Route map', 'rrze-direction')}
								/>
								<RichText
									tagName="div"
									className="rrze-direction-editor__richtext"
									value={directionCar}
									onChange={(value) => setAttributes({ directionCar: value })}
									allowedFormats={['core/bold', 'core/italic', 'core/link']}
									placeholder={
										strings.directionCarPlaceholder ??
										__('Directions by car.', 'rrze-direction')
									}
								/>
							</>
						) : null}

						{showDirectionTransit !== false ? (
							<>
								<h4>
									{strings.directionTransit ??
										__('Bus / train', 'rrze-direction')}
								</h4>
								<RouteMapEditorPlaceholder
									routeJson={directionTransitRoute}
									title={strings.routeMapTitle ?? __('Route map', 'rrze-direction')}
								/>
								<RichText
									tagName="div"
									className="rrze-direction-editor__richtext"
									value={directionTransit}
									onChange={(value) =>
										setAttributes({ directionTransit: value })
									}
									allowedFormats={['core/bold', 'core/italic', 'core/link']}
									placeholder={
										strings.directionTransitPlaceholder ??
										__('Public transport.', 'rrze-direction')
									}
								/>
							</>
						) : null}

						{isLoadingDirections ? (
							<p className="rrze-direction-editor__loading" aria-live="polite">
								{strings.directionsLoading ??
									__('Loading directions…', 'rrze-direction')}
							</p>
						) : null}

						<DirectionsEditorPreview attributes={attributes} strings={strings} />
					</section>
				</div>
			</div>
		</Fragment>
	);
}
