import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ACTIVE_STEP_CLASS = 'is-route-step-active';
const ROUTE_COLOR = '#04316a';
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

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

function scheduleMapResize(map) {
	[0, 120, 350, 700].forEach((delay) => {
		window.setTimeout(() => {
			if (map && !map._removed) {
				map.invalidateSize({ animate: false });
			}
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

			map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16), {
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

	if (container._rrzeLeafletMap) {
		container._rrzeLeafletMap.remove();
		container._rrzeLeafletMap = null;
	}

	delete container.dataset.routeMapReady;
	delete container.dataset.routeMapDeferred;
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
	});
	container._rrzeLeafletMap = map;

	L.tileLayer(TILE_URL, {
		maxZoom: 19,
		attribution:
			'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
	}).addTo(map);

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

	if (data.bounds) {
		const bounds = L.latLngBounds(
			[data.bounds.south, data.bounds.west],
			[data.bounds.north, data.bounds.east]
		);
		map.fitBounds(bounds, { padding: [24, 24] });
	} else {
		map.fitBounds(polyline.getBounds(), { padding: [24, 24] });
	}

	wireStepClicks(container, map, markersByStep);
	scheduleMapResize(map);

	if (typeof ResizeObserver !== 'undefined') {
		const observer = new ResizeObserver(() => {
			if (!map._removed) {
				map.invalidateSize({ animate: false });
			}
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
