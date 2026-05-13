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
import { Fragment, useEffect, useMemo } from '@wordpress/element';
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

function resolveMapIframeSrc(attributes) {
	const mapUrl = `${attributes.mapUrl ?? ''}`.trim();
	if (mapUrl && isApiIframeUrl(mapUrl)) {
		return mapUrl;
	}

	const org = sanitizeOrganizationDigits(attributes.organizationNumber);
	if (org) {
		return `https://${KARTE_HOST_SUFFIX}${KARTE_IFRAME_PATH}/org/${org}/`;
	}

	const lat = parseCoordinate(attributes.mapLatitude);
	const lon = parseCoordinate(attributes.mapLongitude);
	if (lat !== null && lon !== null) {
		const pair = encodeURIComponent(`${lat},${lon}`);

		return `https://${KARTE_HOST_SUFFIX}${KARTE_IFRAME_PATH}/center/${pair}/zoom/16/`;
	}

	const addressQuery = buildAddressParam(
		attributes.addressStreet ?? '',
		attributes.addressZip ?? '',
		attributes.addressCity ?? ''
	);
	if (addressQuery) {
		return `https://${KARTE_HOST_SUFFIX}${KARTE_IFRAME_PATH}/address/${encodeURIComponent(addressQuery)}/`;
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
			},
		});
	} catch (error) {
		return null;
	}
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
			<p className="rrze-direction-editor__coordinates">
				{strings.coordinatesMissing ??
					__('No coordinates detected in API data.', 'rrze-direction')}
			</p>
		);
	}

	return (
		<p className="rrze-direction-editor__coordinates">
			{strings.mapCoordinates ?? __('Coordinates', 'rrze-direction')}:{' '}
			<a href={googleMapsUrl(lat, lon)} target="_blank" rel="noopener noreferrer">
				{strings.googleMaps ?? __('Google Maps', 'rrze-direction')}
			</a>
			<span className="rrze-direction-editor__coordinates-sep" aria-hidden="true">
				{' '}
				·{' '}
			</span>
			<a href={appleMapsUrl(lat, lon)} target="_blank" rel="noopener noreferrer">
				{strings.appleMaps ?? __('Apple Maps', 'rrze-direction')}
			</a>
		</p>
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
	} = attributes;

	const blockProps = useBlockProps({ className: 'rrze-direction-block' });
	const strings = getEditorStrings();
	const personRows = useMemo(() => getPersonRows(), []);

	const streetLine = formatStreetLine(addressStreet, addressZip, addressCity);
	const showFormattedAddress = shouldShowFormattedAddress(
		addressFormatted,
		streetLine
	);
	const mapIframeSrc = resolveMapIframeSrc(attributes);

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

	useEffect(() => {
		if (!personId || !personRows.length) {
			return;
		}

		const row = personRows.find((r) => r.id === Number(personId));
		if (!row?.places?.length) {
			return;
		}

		const id = workplaceKey || row.places[0]?.id;
		const place = id ? row.places.find((p) => p.id === id) : row.places[0];
		if (!place) {
			return;
		}

		let cancelled = false;

		(async () => {
			const coords = await fetchResolvedCoordinates(place);
			const dirs = await fetchOpenRouteDirections(place, coords, {
				addressCity,
				zip: addressZip,
			});

			if (cancelled) {
				return;
			}

			const payload = { ...coords };
			if (dirs?.directionBike) {
				payload.directionBike = dirs.directionBike;
			}
			if (dirs?.directionCar) {
				payload.directionCar = dirs.directionCar;
			}
			if (dirs?.directionTransit) {
				payload.directionTransit = dirs.directionTransit;
			}
			setAttributes(payload);
		})();

		return () => {
			cancelled = true;
		};
	}, [personId, workplaceKey, personRows, addressCity, addressZip]);

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
			});
			return;
		}

		const place =
			(key && selectedRow.places.find((p) => p.id === key)) ||
			selectedRow.places[0];

		setAttributes({
			...snapshotFromPlace(place),
			workplaceKey: place.id ?? '',
			directionBike: '',
			directionCar: '',
			directionTransit: '',
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
									__('Optional map illustration', 'rrze-direction')}
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
				<PanelBody title={strings.selectPerson ?? __('FAUdir', 'rrze-direction')}>
					<SelectControl
						label={
							strings.selectPerson ??
							__('Published FAUdir person entry', 'rrze-direction')
						}
						value={personId ? String(personId) : ''}
						options={personOptions}
						onChange={(next) => {
							const nextId = Number(next) || 0;
							const row = nextId ? personRows.find((r) => r.id === nextId) : null;

							setAttributes({
								personId: nextId,
								mapImageId: 0,
								workplaceKey: '',
							});

							if (!row?.places?.length) {
								setAttributes({
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
								});
								return;
							}

							const snapshot = snapshotFromPlace(row.places[0]);

							setAttributes({
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
								directionBike: '',
								directionCar: '',
								directionTransit: '',
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
							strings.mapUrl ??
							__('Map URL', 'rrze-direction')
						}
						help={
							strings.mapUrlHelp ??
							__(
								'Taken from RRZE-FAUdir (campus map) but can be edited.',
								'rrze-direction'
							)
						}
						value={mapUrl}
						onChange={(next) => setAttributes({ mapUrl: next })}
					/>

					<CoordinateLinks
						latitude={mapLatitude}
						longitude={mapLongitude}
						strings={strings}
					/>

					{mapIllustration}
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
							{strings.addressLabel ?? __('Address', 'rrze-direction')}
							<br />
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
						</address>

						<CoordinateLinks
							latitude={mapLatitude}
							longitude={mapLongitude}
							strings={strings}
							hideWhenMissing
						/>
					</section>

					<section className="rrze-direction-editor__map">
						<h4>{strings.mapSection ?? __('Directions map', 'rrze-direction')}</h4>
						{mapIframeSrc ? (
							<div className="rrze-direction__map-frame">
								<iframe
									title={
										strings.mapServiceTitle ??
										__('FAU map service', 'rrze-direction')
									}
									src={mapIframeSrc}
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
						<h4>
							{strings.directionBike ?? __('Walking / Cycling', 'rrze-direction')}
						</h4>
						<RichText
							tagName="div"
							className="rrze-direction-editor__richtext"
							value={directionBike}
							onChange={(value) => setAttributes({ directionBike: value })}
							allowedFormats={['core/bold', 'core/italic', 'core/link']}
							placeholder={
								strings.directionBikePlaceholder ??
								__('Directions by foot / bike.', 'rrze-direction')
							}
						/>

						<h4>
							{strings.directionCar ?? __('By car', 'rrze-direction')}
						</h4>
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

						<h4>
							{strings.directionTransit ?? __('Bus / train', 'rrze-direction')}
						</h4>
						<RichText
							tagName="div"
							className="rrze-direction-editor__richtext"
							value={directionTransit}
							onChange={(value) => setAttributes({ directionTransit: value })}
							allowedFormats={['core/bold', 'core/italic', 'core/link']}
							placeholder={
								strings.directionTransitPlaceholder ??
								__('Public transport.', 'rrze-direction')
							}
						/>
					</section>
				</div>
			</div>
		</Fragment>
	);
}
