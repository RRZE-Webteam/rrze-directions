import { initRouteMapsIn, destroyRouteMap } from './route-map';
import { attachMapWheelShield } from './map-wheel-shield';
import { initDirectionTabsIn } from './direction-tabs';
import { initStartPillsIn } from './direction-start-pills';
import { initDirectionDropdownIn } from './direction-dropdown';

function handleAccordionPanel(event) {
	const panel = event.target;
	if (!panel?.classList?.contains('rrze-direction__accordion-panel')) {
		return;
	}

	if (event.detail?.open) {
		initRouteMapsIn(panel);
		return;
	}

	panel.querySelectorAll('.rrze-direction-route-map').forEach((map) => {
		destroyRouteMap(map);
	});
}

function injectTileFixStyles() {
	if (document.getElementById('rrze-direction-leaflet-tile-fix')) {
		return;
	}

	const style = document.createElement('style');
	style.id = 'rrze-direction-leaflet-tile-fix';
	style.textContent = `
		.rrze-direction-route-map .leaflet-tile-pane img.leaflet-tile {
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

	document.querySelectorAll('.rrze-direction__map-frame').forEach((frame) => {
		attachMapWheelShield(frame);
	});

	initRouteMapsIn(document);
	initDirectionTabsIn(document);
	initStartPillsIn(document);
	initDirectionDropdownIn(document);

	document.addEventListener('rrze-direction-accordion-panel', handleAccordionPanel);

	document
		.querySelectorAll(
			'.rrze-direction [data-external-tabs-script="1"] [role=tab]'
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
