import { __ } from '@wordpress/i18n';
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
import { Fragment, useMemo } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';

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

function coordsLabel(latRaw, lngRaw, noneLabel) {
	const la = `${latRaw ?? ''}`.trim();
	const lo = `${lngRaw ?? ''}`.trim();

	if (!la || !lo) {
		return noneLabel;
	}

	return `${la}, ${lo}`;
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
		showMap,
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

	const coordReadout = coordsLabel(
		mapLatitude,
		mapLongitude,
		strings.coordinatesMissing ??
			__('No coordinates detected in API data.', 'rrze-direction'),
	);

	const imageDetails = useSelect(
		(select) => {
			if (!mapImageId) {
				return null;
			}

			return select(coreStore).getMedia(mapImageId, { context: 'view' });
		},
		[mapImageId],
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

	const mapIllustration = showMap ? (
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
									{__('Replace illustration', 'rrze-direction')}
								</button>
							)}
						/>
						<button
							type="button"
							className="components-button is-link is-destructive is-small"
							onClick={() => setAttributes({ mapImageId: 0 })}
						>
							{__('Remove illustration', 'rrze-direction')}
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
							<button className="components-button is-primary" type="button" onClick={open}>
								{__('Optional map illustration', 'rrze-direction')}
							</button>
						)}
					/>
				</MediaUploadCheck>
			)}
		</p>
	) : null;

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
								showMap: false,
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
							});
						}}
					/>

					{Boolean(personId) && wpSelectOptions.length > 0 ? (
						<SelectControl
							label={
								strings.selectWorkplace ??
								__('Office / workplace', 'rrze-direction')
							}
							value={
								workplaceKey ||
								selectedRow?.places?.[0]?.id ||
								''
							}
							options={wpSelectOptions}
							onChange={(key) => syncWorkplaceAttrs(key)}
						/>
					) : null}
				</PanelBody>

				<PanelBody title={strings.mapSection ?? __('Map', 'rrze-direction')}>
					<ToggleControl
						label={
							strings.showMap ??
							__('Show arrival map section', 'rrze-direction')
						}
						checked={showMap}
						onChange={(checked) =>
							setAttributes({ showMap: Boolean(checked) })
						}
					/>

					{showMap ? (
						<Fragment>
							<TextControl
								label={
									strings.mapUrl ??
									__('Map URL (preset from FAUdir)', 'rrze-direction')
								}
								help={__(
									'Taken from RRZE-FAUdir (campus map) but can be edited.',
									'rrze-direction',
								)}
								value={mapUrl}
								onChange={(next) =>
									setAttributes({ mapUrl: next })
								}
							/>

							<p className="description">
								<strong>
									{strings.mapCoordinates ?? __('Coordinates', 'rrze-direction')}
								</strong>
								<br />
								{coordReadout}
							</p>

							{mapIllustration}
						</Fragment>
					) : null}
				</PanelBody>
			</InspectorControls>

			<div {...blockProps}>
				<div className="rrze-direction-editor">
					<h3 className="rrze-direction-editor__title">
						{__('Directions', 'rrze-direction')}
						{personId ? ` — ${previewPersonLabel}` : ''}
					</h3>

					<section>
						<h4>
							{strings.addressFromFaudir ??
								__('Address (from FAUdir)', 'rrze-direction')}
						</h4>
						{organizationName ? (
							<p className="rrze-direction-editor__line">{organizationName}</p>
						) : null}
						{addressRoom || addressFloor ? (
							<p className="rrze-direction-editor__line">
								{[addressRoom, addressFloor].filter(Boolean).join(' · ')}
							</p>
						) : null}

						<p className="rrze-direction-editor__line">
							{[addressStreet, [addressZip, addressCity].filter(Boolean).join(' ')]
								.filter(Boolean)
								.join(', ')}
							{!personId ||
							(!addressStreet && !addressZip && !addressCity) ? (
								<>
									<span className="rrze-direction-editor__muted">
										{' '}
										{__('Select person + workplace.', 'rrze-direction')}
									</span>
								</>
							) : null}
						</p>
						{addressFormatted ? (
							<p className="rrze-direction-editor__muted">
								<em>{addressFormatted}</em>
							</p>
						) : null}
					</section>

					{showMap ? (
						<section className="rrze-direction-editor__muted">
							<h4>{strings.mapSection ?? __('Directions map', 'rrze-direction')}</h4>
							<p>
								<strong>{__('Embedded map:', 'rrze-direction')}</strong>{' '}
								{__(
									'The site uses the FAU map API (karte.fau.de): iframe URL if set, otherwise organisation number, map centre from coordinates, or address-based search—per API documentation.',
									'rrze-direction',
								)}
							</p>
							{organizationNumber ? (
								<p className="rrze-direction-editor__muted">
									{__('Organization no. (FAUdir):', 'rrze-direction')}{' '}
									{organizationNumber}
								</p>
							) : null}
							{mapUrl ? <p>{mapUrl}</p> : null}
						</section>
					) : null}

					<section>
						<h4>
							{strings.directionBike ?? __('Walking / Cycling', 'rrze-direction')}
						</h4>
						<RichText
							tagName="div"
							className="rrze-direction-editor__richtext"
							value={directionBike}
							onChange={(value) =>
								setAttributes({ directionBike: value })
							}
							allowedFormats={[
								'core/bold',
								'core/italic',
								'core/link',
							]}
							placeholder={__('Directions by foot / bike.', 'rrze-direction')}
						/>

						<h4>
							{strings.directionCar ?? __('By car', 'rrze-direction')}
						</h4>
						<RichText
							tagName="div"
							className="rrze-direction-editor__richtext"
							value={directionCar}
							onChange={(value) =>
								setAttributes({ directionCar: value })
							}
							allowedFormats={[
								'core/bold',
								'core/italic',
								'core/link',
							]}
							placeholder={__('Directions by car.', 'rrze-direction')}
						/>

						<h4>
							{strings.directionTransit ??
								__('Bus / train', 'rrze-direction')}
						</h4>
						<RichText
							tagName="div"
							className="rrze-direction-editor__richtext"
							value={directionTransit}
							onChange={(value) =>
								setAttributes({ directionTransit: value })
							}
							allowedFormats={[
								'core/bold',
								'core/italic',
								'core/link',
							]}
							placeholder={__('Public transport.', 'rrze-direction')}
						/>
					</section>
				</div>
			</div>
		</Fragment>
	);
}
