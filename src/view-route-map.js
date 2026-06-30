import { initRouteMapsIn, destroyRouteMap } from './route-map';
import { attachMapWheelShield } from './map-wheel-shield';
import { initDirectionsTabsIn } from './directions-tabs';
import { initStartPillsIn } from './directions-start-pills';
import { initDirectionsDropdownIn } from './directions-dropdown';
import { initModePillsIn } from './directions-mode-pills';

function handleAccordionPanel(event) {
	const panel = event.target;
	if (!panel?.classList?.contains('rrze-directions__accordion-panel')) {
		return;
	}

	if (event.detail?.open) {
		initRouteMapsIn(panel);
		return;
	}

	panel.querySelectorAll('.rrze-directions-route-map').forEach((map) => {
		destroyRouteMap(map);
	});
}

function injectTileFixStyles() {
	if (document.getElementById('rrze-directions-leaflet-tile-fix')) {
		return;
	}

	const style = document.createElement('style');
	style.id = 'rrze-directions-leaflet-tile-fix';
	style.textContent = `
		.rrze-directions-route-map .leaflet-tile-pane img.leaflet-tile {
			mix-blend-mode: normal !important;
			max-width: none !important;
			max-height: none !important;
			visibility: visible !important;
			opacity: 1 !important;
		}
	`;
	document.head.appendChild(style);
}

function boot() {
	injectTileFixStyles();

	document.querySelectorAll('.rrze-directions__map-frame').forEach((frame) => {
		attachMapWheelShield(frame);
	});

	initRouteMapsIn(document);
	initDirectionsTabsIn(document);
	initStartPillsIn(document);
	initModePillsIn(document);
	initDirectionsDropdownIn(document);

	document.addEventListener('rrze-directions-accordion-panel', handleAccordionPanel);

	document
		.querySelectorAll(
			'.rrze-directions [data-external-tabs-script="1"] [role=tab]'
		)
		.forEach((tab) => {
			tab.addEventListener('click', () => {
				const panelId = tab.getAttribute('aria-controls');
				const panel = panelId ? document.getElementById(panelId) : null;
				if (panel) {
					initRouteMapsIn(panel);
				}
			});
		});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', boot);
} else {
	boot();
}
