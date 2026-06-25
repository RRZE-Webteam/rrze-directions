import { initRouteMapsIn } from './route-map';

function boot() {
	initRouteMapsIn(document);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', boot);
} else {
	boot();
}
