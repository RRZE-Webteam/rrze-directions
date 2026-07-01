const STATION_COORDS = {
	erlangen: { lat: 49.59583, lon: 11.00472 },
	nuernberg: { lat: 49.44543, lon: 11.08227 },
};

const STATION_KEYS = new Set(['erlangen', 'nuernberg']);

const VGN_TRIP_BASE = 'https://www.vgn.de/universallink/trip/';

function parseCoordinate(value) {
	if (value === null || value === undefined || value === '') {
		return null;
	}

	const normalized = String(value).trim().replace(',', '.');
	if (normalized === '' || Number.isNaN(Number(normalized))) {
		return null;
	}

	const number = Number(normalized);

	return Number.isFinite(number) ? number : null;
}

function formatCoordinate(value) {
	const formatted = value.toFixed(5).replace(/\.?0+$/, '');

	return formatted === '' ? '0' : formatted;
}

function splitLabel(label) {
	const trimmed = `${label ?? ''}`.trim();
	if (trimmed === '') {
		return { name: '', name2: '' };
	}

	const spaceIndex = trimmed.indexOf(' ');
	if (spaceIndex < 0) {
		return { name: trimmed, name2: '' };
	}

	return {
		name: trimmed.slice(0, spaceIndex),
		name2: trimmed.slice(spaceIndex + 1).trim(),
	};
}

export function destinationNames(attributes = {}) {
	const city = `${attributes.addressCity ?? ''}`.trim();
	const org = `${attributes.organizationName ?? ''}`.trim();
	const street = `${attributes.addressStreet ?? ''}`.trim();
	const room = `${attributes.addressRoom ?? ''}`.trim();

	const name = city !== '' ? city : org;
	const secondary = [];

	if (org !== '' && org !== name) {
		secondary.push(org);
	}
	if (street !== '') {
		secondary.push(street);
	}
	if (room !== '') {
		secondary.push(room);
	}

	return {
		name,
		name2: secondary.join(', '),
	};
}

export function isStationStartKey(startKey) {
	return STATION_KEYS.has(startKey);
}

function departureTime() {
	const now = new Date();
	const pad = (value) => String(value).padStart(2, '0');
	const offsetMinutes = -now.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? '+' : '-';
	const absOffset = Math.abs(offsetMinutes);
	const offsetHours = pad(Math.floor(absOffset / 60));
	const offsetMins = pad(absOffset % 60);

	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${offsetHours}${offsetMins}`;
}

export function buildVgnTripUrl(startKey, startLabel, attributes = {}) {
	if (!isStationStartKey(startKey)) {
		return null;
	}

	const station = STATION_COORDS[startKey];
	const destLat = parseCoordinate(attributes.mapLatitude);
	const destLon = parseCoordinate(attributes.mapLongitude);

	if (!station || destLat === null || destLon === null) {
		return null;
	}

	const originNames = splitLabel(startLabel);
	const destNames = destinationNames(attributes);

	if (destNames.name === '') {
		return null;
	}

	const params = new URLSearchParams({
		origin_lat: formatCoordinate(station.lat),
		origin_lng: formatCoordinate(station.lon),
		origin_name: originNames.name,
		destination_lat: formatCoordinate(destLat),
		destination_lng: formatCoordinate(destLon),
		destination_name: destNames.name,
		time: departureTime(),
	});

	if (originNames.name2 !== '') {
		params.set('origin_name2', originNames.name2);
	}
	if (destNames.name2 !== '') {
		params.set('destination_name2', destNames.name2);
	}

	return `${VGN_TRIP_BASE}?${params.toString()}`;
}
