const TILE_SIZE = 256;
const TILE_LAYERS = [
	'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
	'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
];
const TILE_SUBDOMAINS = ['a', 'b', 'c', 'd'];
const ROUTE_COLOR = '#04316a';
const DESTINATION_COLOR = '#c50f3c';

function project(lon, lat, zoom) {
	const scale = TILE_SIZE * 2 ** zoom;
	const sin = Math.sin((lat * Math.PI) / 180);
	const x = ((lon + 180) / 360) * scale;
	const y =
		(0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;

	return [x, y];
}

function boundsFromRoute(routeData) {
	if (routeData.bounds) {
		return { ...routeData.bounds };
	}

	let south = routeData.coordinates[0].lat;
	let north = south;
	let west = routeData.coordinates[0].lon;
	let east = west;

	routeData.coordinates.forEach((point) => {
		south = Math.min(south, point.lat);
		north = Math.max(north, point.lat);
		west = Math.min(west, point.lon);
		east = Math.max(east, point.lon);
	});

	return { south, north, west, east };
}

function expandBounds(bounds, factor = 1.12) {
	const latCenter = (bounds.north + bounds.south) / 2;
	const lonCenter = (bounds.east + bounds.west) / 2;
	const latHalf = ((bounds.north - bounds.south) / 2) * factor || 0.002;
	const lonHalf = ((bounds.east - bounds.west) / 2) * factor || 0.002;

	return {
		south: latCenter - latHalf,
		north: latCenter + latHalf,
		west: lonCenter - lonHalf,
		east: lonCenter + lonHalf,
	};
}

function destinationBounds(routeData, radiusKm = 0.45) {
	const destination =
		routeData.destination &&
		typeof routeData.destination.lat === 'number' &&
		typeof routeData.destination.lon === 'number'
			? routeData.destination
			: routeData.coordinates[routeData.coordinates.length - 1];

	const lat = destination.lat;
	const lon = destination.lon;
	const latDelta = radiusKm / 111;
	const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

	return {
		south: lat - latDelta,
		north: lat + latDelta,
		west: lon - lonDelta,
		east: lon + lonDelta,
	};
}

function computeZoomForBounds(bounds, width, height, padding) {
	const innerWidth = Math.max(width - padding * 2, 1);
	const innerHeight = Math.max(height - padding * 2, 1);

	for (let zoom = 18; zoom >= 4; zoom -= 1) {
		const nw = project(bounds.west, bounds.north, zoom);
		const se = project(bounds.east, bounds.south, zoom);
		const bboxWidth = Math.abs(se[0] - nw[0]);
		const bboxHeight = Math.abs(se[1] - nw[1]);

		if (bboxWidth <= innerWidth && bboxHeight <= innerHeight) {
			return zoom;
		}
	}

	return 4;
}

function tileUrl(template, zoom, x, y) {
	const subdomain = TILE_SUBDOMAINS[(x + y) % TILE_SUBDOMAINS.length];

	return template
		.replace('{s}', subdomain)
		.replace('{z}', String(zoom))
		.replace('{x}', String(x))
		.replace('{y}', String(y));
}

function loadTileImage(template, zoom, x, y) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.decoding = 'async';
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`tile ${zoom}/${x}/${y}`));
		image.src = tileUrl(template, zoom, x, y);
	});
}

async function loadTileImageWithFallback(zoom, x, y) {
	let lastError = null;

	for (const template of TILE_LAYERS) {
		try {
			return await loadTileImage(template, zoom, x, y);
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError ?? new Error(`tile ${zoom}/${x}/${y}`);
}

async function drawBaseTiles(ctx, zoom, topLeftPx, width, height) {
	const tileXStart = Math.floor(topLeftPx[0] / TILE_SIZE);
	const tileYStart = Math.floor(topLeftPx[1] / TILE_SIZE);
	const tileXEnd = Math.floor((topLeftPx[0] + width) / TILE_SIZE);
	const tileYEnd = Math.floor((topLeftPx[1] + height) / TILE_SIZE);
	const jobs = [];

	for (let tileX = tileXStart; tileX <= tileXEnd; tileX += 1) {
		for (let tileY = tileYStart; tileY <= tileYEnd; tileY += 1) {
			jobs.push(
				loadTileImageWithFallback(zoom, tileX, tileY)
					.then((image) => {
						const dx = tileX * TILE_SIZE - topLeftPx[0];
						const dy = tileY * TILE_SIZE - topLeftPx[1];
						ctx.drawImage(image, dx, dy);
					})
					.catch(() => {
						// Skip failed tiles; route overlay still renders.
					})
			);
		}
	}

	await Promise.all(jobs);
}

function projectToCanvas(lon, lat, zoom, topLeftPx) {
	const world = project(lon, lat, zoom);

	return [world[0] - topLeftPx[0], world[1] - topLeftPx[1]];
}

function drawRouteOverlay(ctx, routeData, zoom, topLeftPx, options = {}) {
	if (options.drawRoute === false) {
		const destination =
			routeData.destination &&
			typeof routeData.destination.lat === 'number' &&
			typeof routeData.destination.lon === 'number'
				? routeData.destination
				: routeData.coordinates[routeData.coordinates.length - 1];

		if (!destination) {
			return;
		}

		const [x, y] = projectToCanvas(
			destination.lon,
			destination.lat,
			zoom,
			topLeftPx
		);

		ctx.fillStyle = DESTINATION_COLOR;
		ctx.beginPath();
		ctx.arc(x, y, 10, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 3;
		ctx.stroke();

		return;
	}

	ctx.strokeStyle = ROUTE_COLOR;
	ctx.lineWidth = 5;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.beginPath();

	routeData.coordinates.forEach((point, index) => {
		const [x, y] = projectToCanvas(point.lon, point.lat, zoom, topLeftPx);

		if (index === 0) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	});

	ctx.stroke();

	routeData.steps.forEach((step) => {
		const [x, y] = projectToCanvas(step.lon, step.lat, zoom, topLeftPx);

		ctx.fillStyle = ROUTE_COLOR;
		ctx.beginPath();
		ctx.arc(x, y, 11, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(String(step.n), x, y + 0.5);
	});

	const destination =
		routeData.destination &&
		typeof routeData.destination.lat === 'number' &&
		typeof routeData.destination.lon === 'number'
			? routeData.destination
			: routeData.coordinates[routeData.coordinates.length - 1];

	if (destination) {
		const [x, y] = projectToCanvas(
			destination.lon,
			destination.lat,
			zoom,
			topLeftPx
		);

		ctx.fillStyle = DESTINATION_COLOR;
		ctx.beginPath();
		ctx.arc(x, y, 8, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 2;
		ctx.stroke();
	}
}

async function renderRoutedMapImage(routeData, options = {}) {
	const width = options.width ?? 900;
	const height = options.height ?? 420;
	const padding = options.padding ?? 24;
	const focus = options.focus ?? 'bounds';

	const bounds =
		focus === 'destination'
			? destinationBounds(routeData, options.radiusKm ?? 0.45)
			: expandBounds(boundsFromRoute(routeData), options.expandFactor ?? 1.12);

	const zoom =
		options.zoom ??
		(focus === 'destination'
			? Math.min(computeZoomForBounds(bounds, width, height, padding) + 1, 17)
			: computeZoomForBounds(bounds, width, height, padding));

	const center = {
		lat: (bounds.north + bounds.south) / 2,
		lon: (bounds.east + bounds.west) / 2,
	};
	const centerPx = project(center.lon, center.lat, zoom);
	const topLeftPx = [centerPx[0] - width / 2, centerPx[1] - height / 2];

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');

	if (!ctx) {
		return canvas;
	}

	ctx.fillStyle = '#e6ebf0';
	ctx.fillRect(0, 0, width, height);

	await drawBaseTiles(ctx, zoom, topLeftPx, width, height);
	drawRouteOverlay(ctx, routeData, zoom, topLeftPx, options);

	return canvas;
}

export async function renderOverviewMapImage(routeData) {
	return renderRoutedMapImage(routeData, {
		width: 900,
		height: 420,
		focus: 'bounds',
		drawRoute: true,
	});
}

export async function renderDetailMapImage(routeData) {
	return renderRoutedMapImage(routeData, {
		width: 900,
		height: 420,
		focus: 'destination',
		radiusKm: 0.35,
		drawRoute: false,
	});
}

export async function tryCaptureLeafletMap(routeMapEl) {
	const map = routeMapEl._rrzeLeafletMap;

	if (!map || map._removed) {
		return null;
	}

	const leafletContainer = routeMapEl.querySelector('.leaflet-container');

	if (!leafletContainer) {
		return null;
	}

	await new Promise((resolve) => {
		map.whenReady(resolve);
	});
	await new Promise((resolve) => {
		window.setTimeout(resolve, 350);
	});

	try {
		const { default: html2canvas } = await import('html2canvas');
		const snapshot = await html2canvas(leafletContainer, {
			useCORS: true,
			allowTaint: false,
			logging: false,
			scale: 1,
			backgroundColor: '#e6ebf0',
		});

		try {
			const probe = snapshot.toDataURL('image/png');

			if (!probe || probe.length < 100) {
				return null;
			}
		} catch (error) {
			return null;
		}

		return snapshot;
	} catch (error) {
		return null;
	}
}
