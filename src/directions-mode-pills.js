import { initRouteMapsIn, destroyRouteMap } from './route-map';
import { initStartPillsIn } from './directions-start-pills';

function setActiveModePill(switcher, pill) {
	const key = pill.dataset.modeKey ?? '';

	switcher.querySelectorAll('.rrze-directions__mode-pill').forEach((button) => {
		const active = button === pill;
		button.classList.toggle('is-active', active);
		button.setAttribute('aria-selected', active ? 'true' : 'false');
		button.tabIndex = active ? 0 : -1;
	});

	switcher.querySelectorAll('.rrze-directions__mode-variant').forEach((panel) => {
		const active = panel.dataset.modeKey === key;
		panel.classList.toggle('is-active', active);
		panel.hidden = !active;

		if (!active) {
			panel.querySelectorAll('.rrze-directions-route-map').forEach((map) => {
				destroyRouteMap(map);
			});
			return;
		}

		initStartPillsIn(panel);
		initRouteMapsIn(panel);
	});
}

function focusSiblingModePill(pill, direction) {
	const switcher = pill.closest('[data-mode-switcher="1"]');
	if (!switcher) {
		return;
	}

	const pills = Array.from(switcher.querySelectorAll('.rrze-directions__mode-pill'));
	const index = pills.indexOf(pill);
	if (index < 0) {
		return;
	}

	const nextIndex =
		direction === 'next'
			? (index + 1) % pills.length
			: (index - 1 + pills.length) % pills.length;
	const nextPill = pills[nextIndex];

	setActiveModePill(switcher, nextPill);
	nextPill.focus();
}

export function initModePillsIn(root = document) {
	if (!root || typeof root.querySelectorAll !== 'function') {
		return;
	}

	root.querySelectorAll('[data-mode-switcher="1"]').forEach((switcher) => {
		if (switcher.dataset.modeSwitcherInit === '1') {
			return;
		}

		switcher.dataset.modeSwitcherInit = '1';

		const activePanel = switcher.querySelector('.rrze-directions__mode-variant.is-active');
		if (activePanel) {
			initStartPillsIn(activePanel);
			initRouteMapsIn(activePanel);
		}

		switcher.querySelectorAll('.rrze-directions__mode-pill').forEach((pill) => {
			pill.addEventListener('click', () => {
				setActiveModePill(switcher, pill);
			});

			pill.addEventListener('keydown', (event) => {
				switch (event.key) {
					case 'ArrowRight':
					case 'ArrowDown':
						event.preventDefault();
						focusSiblingModePill(pill, 'next');
						break;
					case 'ArrowLeft':
					case 'ArrowUp':
						event.preventDefault();
						focusSiblingModePill(pill, 'prev');
						break;
					case 'Home':
						event.preventDefault();
						setActiveModePill(
							switcher,
							switcher.querySelector('.rrze-directions__mode-pill')
						);
						switcher.querySelector('.rrze-directions__mode-pill')?.focus();
						break;
					case 'End': {
						event.preventDefault();
						const pills = switcher.querySelectorAll('.rrze-directions__mode-pill');
						const lastPill = pills[pills.length - 1];
						if (lastPill) {
							setActiveModePill(switcher, lastPill);
							lastPill.focus();
						}
						break;
					}
					default:
						break;
				}
			});
		});
	});
}
