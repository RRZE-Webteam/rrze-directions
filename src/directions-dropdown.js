import { initRouteMapsIn, destroyRouteMap } from './route-map';

function setActiveMode(dropdown, modeKey) {
	dropdown.querySelectorAll('.rrze-directions__mode-panel').forEach((panel) => {
		const active = panel.dataset.mode === modeKey;
		panel.classList.toggle('is-active', active);
		panel.hidden = !active;

		if (!active) {
			panel.querySelectorAll('.rrze-directions-route-map').forEach((map) => {
				destroyRouteMap(map);
			});
		}
	});

	const activePanel = dropdown.querySelector(
		`.rrze-directions__mode-panel[data-mode="${modeKey}"]`
	);
	if (activePanel) {
		initRouteMapsIn(activePanel);
	}
}

export function initDirectionsDropdownIn(root = document) {
	if (!root || typeof root.querySelectorAll !== 'function') {
		return;
	}

	root.querySelectorAll('.rrze-directions__directionss--dropdown').forEach((dropdown) => {
		if (dropdown.dataset.dropdownInit === '1') {
			return;
		}

		const select = dropdown.querySelector('[data-mode-select="1"]');
		if (!select) {
			return;
		}

		dropdown.dataset.dropdownInit = '1';

		select.addEventListener('change', () => {
			setActiveMode(dropdown, select.value);
		});
	});
}
