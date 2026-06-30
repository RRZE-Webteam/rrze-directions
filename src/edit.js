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
import { DirectionModeIcon, StartPointIcon } from './mode-icons';

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

async function fetchOpenRouteDirections(place, coords, extras = {}) {
	const path = window.rrze_directions?.restOpenRouteDirectionsPath;
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

	return ['directionsBike', 'directionsCar', 'directionsTransit'].some((key) =>
		hasDirectionsContent(dirs[key])
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

function applyDirectionsPayload(payload, dirs) {
	if (!dirs || !directionsResponseHasContent(dirs)) {
		return;
	}

	payload.directionsBike = dirs.directionsBike ?? '';
	payload.directionsCar = dirs.directionsCar ?? '';
	payload.directionsTransit = dirs.directionsTransit ?? '';
	payload.directionsBikeRoute = dirs.directionsBikeRoute ?? '';
	payload.directionsCarRoute = dirs.directionsCarRoute ?? '';
	payload.directionsTransitRoute = dirs.directionsTransitRoute ?? '';
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

function hasDirectionsContent(html) {
	return `${html ?? ''}`.replace(/<[^>]*>/g, '').trim() !== '';
}

function hasRouteData(routeJson) {
	if (!routeJson) {
		return false;
	}

	try {
		const data = JSON.parse(routeJson);
		if (Array.isArray(data?.variants)) {
			return data.variants.some((variant) =>
				hasRouteData(JSON.stringify(variant?.route ?? {}))
			);
		}

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

function parseRouteVariants(routeJson) {
	if (!routeJson) {
		return [];
	}

	try {
		const data = JSON.parse(routeJson);
		if (Array.isArray(data?.variants)) {
			return data.variants
				.map((variant) => ({
					startKey: `${variant?.startKey ?? ''}`,
					startLabel: `${variant?.startLabel ?? ''}`,
					route: variant?.route ?? null,
				}))
				.filter((variant) => hasRouteData(JSON.stringify(variant.route ?? {})));
		}

		if (hasRouteData(routeJson)) {
			return [{ startKey: '', startLabel: '', route: data }];
		}
	} catch (error) {
		return [];
	}

	return [];
}

function splitRouteVariantHtml(html) {
	const source = `${html ?? ''}`;
	if (!source.includes('rrze-directions__route-variant')) {
		const trimmed = source.trim();
		return trimmed ? [trimmed] : [];
	}

	const marker =
		/<div class="rrze-directions__route-variant">([\s\S]*?)<\/div>/g;
	const parts = [];
	let match = marker.exec(source);

	while (match) {
		parts.push(match[1].trim());
		match = marker.exec(source);
	}

	if (parts.length > 0) {
		return parts;
	}

	const parser = new DOMParser();
	const document = parser.parseFromString(
		`<div id="rrze-directions-root">${source}</div>`,
		'text/html'
	);
	const nodes = document.querySelectorAll('.rrze-directions__route-variant');

	nodes.forEach((node) => {
		parts.push(node.innerHTML.trim());
	});

	if (parts.length > 0) {
		return parts;
	}

	const trimmed = source.trim();
	return trimmed ? [trimmed] : [];
}

function getVisibleDirectionsSections(attributes, strings) {
	const sections = [
		{
			key: 'bike',
			enabled: attributes.showDirectionsBike !== false,
			content: attributes.directionsBike,
			route: attributes.directionsBikeRoute,
			title: strings.directionsBike ?? __('Walking / Cycling', 'rrze-directions'),
			placeholder:
				strings.directionsBikePlaceholder ??
				__('Directions by foot / bike.', 'rrze-directions'),
		},
		{
			key: 'car',
			enabled: attributes.showDirectionsCar !== false,
			content: attributes.directionsCar,
			route: attributes.directionsCarRoute,
			title: strings.directionsCar ?? __('By car', 'rrze-directions'),
			placeholder:
				strings.directionsCarPlaceholder ??
				__('Directions by car.', 'rrze-directions'),
		},
		{
			key: 'transit',
			enabled: attributes.showDirectionsTransit !== false,
			content: attributes.directionsTransit,
			route: attributes.directionsTransitRoute,
			title: strings.directionsTransit ?? __('Bus / train', 'rrze-directions'),
			placeholder:
				strings.directionsTransitPlaceholder ??
				__('Public transport.', 'rrze-directions'),
		},
	];

	return sections.filter(
		(section) => section.enabled && hasDirectionsContent(section.content)
	);
}

function normalizeDirectionsLayout(layout) {
	if (
		layout === 'accordion' ||
		layout === 'columns' ||
		layout === 'tabs' ||
		layout === 'dropdown'
	) {
		return layout;
	}

	return 'pills';
}

function variantKey(variant, index) {
	if (!variant) {
		return `variant-${index}`;
	}

	return variant.startKey || `variant-${index}`;
}

function RouteVariantsEditorMaps({ routeJson, strings }) {
	const variants = parseRouteVariants(routeJson);
	const mapHint =
		strings.routeMapPreview ??
		__(
			'Interactive route map with numbered steps is shown on the published page.',
			'rrze-directions'
		);
	const [activeKey, setActiveKey] = useState(() =>
		variantKey(variants[0], 0)
	);

	useEffect(() => {
		if (variants.length === 0) {
			return;
		}

		setActiveKey((current) => {
			if (variants.some((variant, index) => variantKey(variant, index) === current)) {
				return current;
			}

			return variantKey(variants[0], 0);
		});
	}, [routeJson]);

	if (variants.length > 1) {
		return (
			<div className="rrze-directions__start-switcher">
				<div className="rrze-directions__start-pills" role="tablist">
					{variants.map((variant, index) => {
						const key = variantKey(variant, index);
						const active = key === activeKey;

						return (
							<button
								key={key}
								type="button"
								className={`rrze-directions__start-pill${
									active ? ' is-active' : ''
								}`}
								role="tab"
								aria-selected={active}
								onClick={() => setActiveKey(key)}
							>
								<StartPointIcon startKey={variant.startKey || key} />
								<span className="rrze-directions__start-pill-label">
									{variant.startLabel ||
										strings.routeMapTitle ||
										__('Route map', 'rrze-directions')}
								</span>
							</button>
						);
					})}
				</div>
				<div className="rrze-directions__start-panels">
					{variants.map((variant, index) => {
						const key = variantKey(variant, index);

						return (
							<div
								key={key}
								className={`rrze-directions__route-variant${
									key === activeKey ? ' is-active' : ''
								}`}
								role="tabpanel"
								hidden={key !== activeKey}
							>
								<RouteMapEditorPlaceholder
									routeJson={JSON.stringify(variant.route)}
									title={
										variant.startLabel ||
										strings.routeMapTitle ||
										__('Route map', 'rrze-directions')
									}
									hint={mapHint}
								/>
							</div>
						);
					})}
				</div>
			</div>
		);
	}

	return (
		<RouteMapEditorPlaceholder
			routeJson={
				variants.length === 1
					? JSON.stringify(variants[0].route)
					: routeJson
			}
			title={strings.routeMapTitle ?? __('Route map', 'rrze-directions')}
			hint={mapHint}
		/>
	);
}

function DirectionsStartSwitcher({ routeJson, content, strings }) {
	const variants = useMemo(() => parseRouteVariants(routeJson), [routeJson]);
	const htmlParts = useMemo(() => splitRouteVariantHtml(content), [content]);
	const [activeKey, setActiveKey] = useState(() => variantKey(variants[0], 0));
	const mapHint =
		strings.routeMapPreview ??
		__(
			'Interactive route map with numbered steps is shown on the published page.',
			'rrze-directions'
		);

	useEffect(() => {
		if (variants.length === 0) {
			return;
		}

		setActiveKey((current) => {
			if (variants.some((variant, index) => variantKey(variant, index) === current)) {
				return current;
			}

			return variantKey(variants[0], 0);
		});
	}, [routeJson, variants]);

	return (
		<div className="rrze-directions__start-switcher">
			<div
				className="rrze-directions__start-pills"
				role="tablist"
				aria-label={strings.startingPoint ?? __('Starting point', 'rrze-directions')}
			>
				{variants.map((variant, index) => {
					const key = variantKey(variant, index);
					const active = key === activeKey;

					return (
						<button
							key={key}
							type="button"
							className={`rrze-directions__start-pill${
								active ? ' is-active' : ''
							}`}
							role="tab"
							aria-selected={active}
							onClick={() => setActiveKey(key)}
						>
							<StartPointIcon startKey={variant.startKey || key} />
							<span className="rrze-directions__start-pill-label">
								{variant.startLabel ||
									sprintf(
										/* translators: %d: route variant number */
										__('Route %d', 'rrze-directions'),
										index + 1
									)}
							</span>
						</button>
					);
				})}
			</div>
			<div className="rrze-directions__start-panels">
				{variants.map((variant, index) => {
					const key = variantKey(variant, index);

					return (
						<div
							key={key}
							className={`rrze-directions__route-variant${
								key === activeKey ? ' is-active' : ''
							}`}
							role="tabpanel"
							hidden={key !== activeKey}
						>
							<RouteMapEditorPlaceholder
								routeJson={JSON.stringify(variant.route)}
								title={
									variant.startLabel ||
									strings.routeMapTitle ||
									__('Route map', 'rrze-directions')
								}
								hint={mapHint}
							/>
							<div
								className="rrze-directions__rte"
								dangerouslySetInnerHTML={{
									__html: htmlParts[index] ?? '',
								}}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function DirectionsSectionPreviewBody({ section, strings }) {
	const variants = parseRouteVariants(section.route);
	const htmlParts = splitRouteVariantHtml(section.content);
	const mapHint =
		strings.routeMapPreview ??
		__(
			'Interactive route map with numbered steps is shown on the published page.',
			'rrze-directions'
		);

	if (variants.length > 1) {
		return (
			<DirectionsStartSwitcher
				routeJson={section.route}
				content={section.content}
				strings={strings}
			/>
		);
	}

	if (variants.length === 1) {
		return (
			<>
				<RouteMapEditorPlaceholder
					routeJson={JSON.stringify(variants[0].route)}
					title={
						variants[0].startLabel ||
						strings.routeMapTitle ||
						__('Route map', 'rrze-directions')
					}
					hint={mapHint}
				/>
				<div
					className="rrze-directions__rte"
					dangerouslySetInnerHTML={{
						__html: htmlParts[0] ?? section.content,
					}}
				/>
			</>
		);
	}

	return (
		<>
			<RouteMapEditorPlaceholder
				routeJson={section.route}
				title={strings.routeMapTitle ?? __('Route map', 'rrze-directions')}
				hint={mapHint}
			/>
			<div
				className="rrze-directions__rte"
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
			'rrze-directions'
		);

	return (
		<div className="rrze-directions-route-map rrze-directions-route-map--editor-placeholder">
			{title ? (
				<h4 className="rrze-directions-route-map__title">{title}</h4>
			) : null}
			<div className="rrze-directions-route-map__preview" aria-hidden="true">
				<svg
					className="rrze-directions-route-map__preview-svg"
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
			<p className="rrze-directions-route-map__hint">{previewHint}</p>
		</div>
	);
}

function DirectionsEditorPreview({ attributes, strings }) {
	const layout = normalizeDirectionsLayout(attributes.directionsLayout);
	const sections = getVisibleDirectionsSections(attributes, strings);
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
		layout === 'pills'
			? strings.directionsLayoutPills ?? __('Pills', 'rrze-directions')
			: layout === 'columns'
			? strings.directionsLayoutColumns ?? __('Columns', 'rrze-directions')
			: layout === 'tabs'
				? strings.directionsLayoutTabs ?? __('Tabs', 'rrze-directions')
				: layout === 'dropdown'
					? strings.directionsLayoutDropdown ?? __('Dropdown', 'rrze-directions')
					: strings.directionsLayoutAccordion ?? __('Accordion', 'rrze-directions');

	let preview = null;

	if (layout === 'pills') {
		if (sections.length === 1) {
			preview = (
				<div className="rrze-directions__directions rrze-directions__directions--mode-pills">
					<DirectionsSectionPreviewBody
						section={sections[0]}
						strings={strings}
					/>
				</div>
			);
		} else {
			const activeIndex = Math.max(
				0,
				sections.findIndex((section) => section.key === activeKey)
			);

			preview = (
				<div className="rrze-directions__directions rrze-directions__directions--mode-pills">
					<div className="rrze-directions__mode-switcher">
						<div
							className="rrze-directions__mode-pills"
							role="tablist"
							aria-label={
								strings.modeOfTransport ??
								__('Mode of transport', 'rrze-directions')
							}
						>
							{sections.map((section, index) => (
								<button
									key={section.key}
									type="button"
									className={`rrze-directions__mode-pill${
										index === activeIndex ? ' is-active' : ''
									}`}
									role="tab"
									aria-selected={index === activeIndex}
									onClick={() => setActiveKey(section.key)}
								>
									<DirectionModeIcon modeKey={section.key} />
									<span className="rrze-directions__mode-pill-label">
										{section.title}
									</span>
								</button>
							))}
						</div>
						<div className="rrze-directions__mode-panels">
							{sections.map((section, index) => (
								<div
									key={section.key}
									className={`rrze-directions__mode-variant${
										index === activeIndex ? ' is-active' : ''
									}`}
									role="tabpanel"
									aria-label={section.title}
									hidden={index !== activeIndex}
								>
									<h3 className="screen-reader-text">{section.title}</h3>
									<DirectionsSectionPreviewBody
										section={section}
										strings={strings}
									/>
								</div>
							))}
						</div>
					</div>
				</div>
			);
		}
	} else if (layout === 'accordion') {
		preview = (
			<div className="rrze-directions__directions rrze-directions__accordions">
				<div className="rrze-directions__accordion">
					{sections.map((section, index) => (
						<div
							key={section.key}
							className="rrze-directions__accordion-item"
						>
							<div className="rrze-directions__accordion-group">
								<h3 className="rrze-directions__accordion-heading">
									<button
										type="button"
										className={
											index === 0
												? 'rrze-directions__accordion-toggle active'
												: 'rrze-directions__accordion-toggle'
										}
										aria-expanded={index === 0}
									>
										{section.title}
									</button>
								</h3>
								<div
									className={
										index === 0
											? 'rrze-directions__accordion-panel open'
											: 'rrze-directions__accordion-panel'
									}
									role="region"
									hidden={index !== 0 ? true : undefined}
								>
									<div className="rrze-directions__accordion-inner clearfix">
										<DirectionsSectionPreviewBody
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
			<div className="rrze-directions__directions">
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
							<DirectionsSectionPreviewBody
								section={section}
								strings={strings}
							/>
						</div>
					))}
				</div>
			</div>
		);
	} else if (layout === 'dropdown') {
		const activeIndex = Math.max(
			0,
			sections.findIndex((section) => section.key === activeKey)
		);

		preview = (
			<div className="rrze-directions__directions rrze-directions__directions--dropdown">
				<div className="rrze-directions__mode-dropdown">
					<label
						className="rrze-directions__mode-label"
						htmlFor="rrze-directions-editor-mode-select"
					>
						{strings.modeOfTransport ??
							__('Mode of transport', 'rrze-directions')}
					</label>
					<select
						id="rrze-directions-editor-mode-select"
						className="rrze-directions__mode-select"
						value={sections[activeIndex]?.key ?? ''}
						onChange={(event) => setActiveKey(event.target.value)}
					>
						{sections.map((section) => (
							<option key={section.key} value={section.key}>
								{section.title}
							</option>
						))}
					</select>
				</div>
				<div className="rrze-directions__mode-panels">
					{sections.map((section, index) => (
						<div
							key={section.key}
							className={`rrze-directions__mode-panel${
								index === activeIndex ? ' is-active' : ''
							}`}
							role="region"
							aria-label={section.title}
							hidden={index !== activeIndex}
						>
							<h3 className="screen-reader-text">{section.title}</h3>
							<DirectionsSectionPreviewBody
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
				className={`rrze-directions__directions rrze-directions__directions-grid rrze-directions__directions-grid--cols-${
					sections.length >= 3 ? 3 : sections.length
				}`}
			>
				{sections.map((section) => (
					<section
						key={section.key}
						className="rrze-directions__text rrze-directions__text--column"
					>
						<h3>{section.title}</h3>
						<DirectionsSectionPreviewBody
							section={section}
							strings={strings}
						/>
					</section>
				))}
			</div>
		);
	}

	return (
		<div className="rrze-directions-editor__directions-preview">
			<p className="rrze-directions-editor__directions-preview-label">
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
		directionsBike,
		directionsCar,
		directionsTransit,
		directionsBikeRoute,
		directionsCarRoute,
		directionsTransitRoute,
		showDirectionsBike,
		showDirectionsCar,
		showDirectionsTransit,
		directionsLayout,
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
		selectedRow?.label ?? __('Directions', 'rrze-directions');

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
						onChange={(next) => setAttributes({ mapUrl: next })}
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
					<h3 className="rrze-directions-editor__title">
						{__('Directions', 'rrze-directions')}
						{personId ? ` — ${previewPersonLabel}` : ''}
					</h3>

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
