import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './route-map.scss';
import { attachMapWheelShield, detachMapWheelShield } from './map-wheel-shield';

const ACTIVE_STEP_CLASS = 'is-route-step-active';
const ROUTE_COLOR = '#04316a';
const MAP_MAX_ZOOM = 19;
const MAP_OVERVIEW_MAX_ZOOM = 17;
const TILE_MAX_NATIVE_ZOOM = 19;

const TILE_LAYER_DEFAULTS = {
	detectRetina: false,
	maxZoom: MAP_MAX_ZOOM,
	maxNativeZoom: TILE_MAX_NATIVE_ZOOM,
};

const TILE_LAYERS = [
	{
		url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
		options: {
			subdomains: 'abcd',
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
		},
	},
	{
		url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
		options: {
			subdomains: 'abc',
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		},
	},
];

function parseRoute(container) {
	const raw = container.getAttribute('data-route');
	if (!raw) {
		return null;
	}

	try {
		const data = JSON.parse(raw);
		if (
			!data ||
			!Array.isArray(data.coordinates) ||
			data.coordinates.length < 2 ||
			!Array.isArray(data.steps)
		) {
			return null;
		}

		return data;
	} catch (error) {
		return null;
	}
}

function numberedIcon(number) {
	return L.divIcon({
		className: 'rrze-direction-route-marker',
		html: `<span class="rrze-direction-route-marker__label">${number}</span>`,
		iconSize: [30, 30],
		iconAnchor: [15, 15],
	});
}

function findStepContainer(routeMapEl) {
	return (
		routeMapEl.closest('.rrze-answers-content') ||
		routeMapEl.closest('.rrze-direction__text--column') ||
		routeMapEl.parentElement
	);
}

function refreshMapTiles(map, tileLayer) {
	if (!map || map._removed) {
		return;
	}

	map.invalidateSize({ animate: false });

	if (tileLayer) {
		tileLayer.redraw();
	}
}

function scheduleMapResize(map, tileLayer) {
	[0, 120, 350, 700].forEach((delay) => {
		window.setTimeout(() => {
			refreshMapTiles(map, tileLayer);
		}, delay);
	});
}

function wireStepClicks(routeMapEl, map, markersByStep) {
	const container = findStepContainer(routeMapEl);
	if (!container) {
		return;
	}

	const steps = container.querySelectorAll('.rrze-direction-ors-step');
	steps.forEach((stepEl, index) => {
		const stepNumber = index + 1;
		stepEl.setAttribute('tabindex', '0');
		stepEl.setAttribute('role', 'button');

		const activate = () => {
			steps.forEach((el) => el.classList.remove(ACTIVE_STEP_CLASS));
			stepEl.classList.add(ACTIVE_STEP_CLASS);

			const marker = markersByStep[stepNumber];
			if (!marker) {
				return;
			}

			map.setView(marker.getLatLng(), Math.min(Math.max(map.getZoom(), 16), MAP_OVERVIEW_MAX_ZOOM), {
				animate: true,
			});
			marker.openPopup();
		};

		stepEl.addEventListener('click', activate);
		stepEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				activate();
			}
		});
	});
}

export function destroyRouteMap(container) {
	if (!container) {
		return;
	}

	if (container._rrzeResizeObserver) {
		container._rrzeResizeObserver.disconnect();
		container._rrzeResizeObserver = null;
	}

	const canvas = container.querySelector('.rrze-direction-route-map__canvas');
	if (canvas) {
		detachMapWheelShield(canvas);
	}

	if (container._rrzeLeafletMap) {
		container._rrzeLeafletMap.remove();
		container._rrzeLeafletMap = null;
	}

	delete container.dataset.routeMapReady;
	delete container.dataset.routeMapDeferred;
}

function fixTileImage(img, tileLayer) {
	if (!img || !img.style) {
		return;
	}

	const size = tileLayer.getTileSize();
	const width = size?.x ?? 256;
	const height = size?.y ?? 256;

	img.style.setProperty('width', `${width}px`, 'important');
	img.style.setProperty('height', `${height}px`, 'important');
	img.style.setProperty('mix-blend-mode', 'normal', 'important');
	img.style.setProperty('max-width', 'none', 'important');
	img.style.setProperty('max-height', 'none', 'important');
	img.style.setProperty('visibility', 'visible', 'important');
	img.style.setProperty('opacity', '1', 'important');
	img.classList.add('leaflet-tile-loaded');
}

function addTileLayerWithFallback(map, layerIndex = 0) {
	const layerDef = TILE_LAYERS[layerIndex];
	if (!layerDef) {
		return null;
	}

	const tileLayer = L.tileLayer(layerDef.url, {
		...TILE_LAYER_DEFAULTS,
		...layerDef.options,
	}).addTo(map);
	let errorCount = 0;

	tileLayer.on('tileload', (event) => {
		fixTileImage(event.tile, tileLayer);
	});

	tileLayer.on('tileerror', () => {
		errorCount += 1;
		if (errorCount < 4 || layerIndex >= TILE_LAYERS.length - 1) {
			return;
		}

		map.removeLayer(tileLayer);
		addTileLayerWithFallback(map, layerIndex + 1);
	});

	return tileLayer;
}

function createRouteMap(container, data) {
	const canvas = container.querySelector('.rrze-direction-route-map__canvas');
	if (!canvas) {
		return;
	}

	destroyRouteMap(container);
	container.dataset.routeMapReady = '1';

	const map = L.map(canvas, {
		scrollWheelZoom: false,
		attributionControl: true,
		detectRetina: false,
		maxZoom: MAP_MAX_ZOOM,
	});
	if (map.scrollWheelZoom) {
		map.scrollWheelZoom.disable();
	}
	container._rrzeLeafletMap = map;

	const latLngs = data.coordinates.map((point) => [point.lat, point.lon]);
	const polyline = L.polyline(latLngs, {
		color: ROUTE_COLOR,
		weight: 5,
		opacity: 0.85,
	}).addTo(map);

	const markersByStep = {};

	data.steps.forEach((step) => {
		const marker = L.marker([step.lat, step.lon], {
			icon: numberedIcon(step.n),
		}).addTo(map);

		marker.bindPopup(`<strong>${step.n}.</strong> ${step.instruction || ''}`);
		markersByStep[step.n] = marker;
	});

	const bounds = data.bounds
		? L.latLngBounds(
				[data.bounds.south, data.bounds.west],
				[data.bounds.north, data.bounds.east]
			)
		: polyline.getBounds();

	map.fitBounds(bounds, {
		padding: [24, 24],
		animate: false,
		maxZoom: MAP_OVERVIEW_MAX_ZOOM,
	});
	map.invalidateSize({ animate: false });

	const tileLayer = addTileLayerWithFallback(map);

	attachMapWheelShield(canvas);

	wireStepClicks(container, map, markersByStep);
	scheduleMapResize(map, tileLayer);

	map.whenReady(() => {
		if (map._removed) {
			return;
		}

		refreshMapTiles(map, tileLayer);

		if (tileLayer) {
			container.querySelectorAll('.leaflet-tile-pane img').forEach((img) => {
				fixTileImage(img, tileLayer);
			});
		}
	});

	if (typeof ResizeObserver !== 'undefined') {
		const observer = new ResizeObserver(() => {
			refreshMapTiles(map, tileLayer);
		});
		observer.observe(canvas);
		container._rrzeResizeObserver = observer;
	}
}

export function initRouteMap(container) {
	if (!container || typeof container.querySelector !== 'function') {
		return;
	}

	const details = container.closest('details');
	if (details && !details.open) {
		if (container.dataset.routeMapDeferred !== '1') {
			container.dataset.routeMapDeferred = '1';
			details.addEventListener('toggle', () => {
				if (details.open) {
					initRouteMap(container);
				}
			});
		}
		return;
	}

	const data = parseRoute(container);
	if (!data) {
		return;
	}

	createRouteMap(container, data);
}

export function initRouteMapsIn(root = document) {
	if (!root || typeof root.querySelectorAll !== 'function') {
		return;
	}

	root.querySelectorAll('.rrze-direction-route-map').forEach((container) => {
		initRouteMap(container);
	});
}
