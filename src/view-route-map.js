import { initRouteMapsIn } from './route-map';

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
	initRouteMapsIn(document);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', boot);
} else {
	boot();
}
