import { initRouteMapsIn, destroyRouteMap } from './route-map';

function setActivePill(switcher, pill) {
	const key = pill.dataset.startKey ?? '';

	switcher.querySelectorAll('.rrze-directions__start-pill').forEach((button) => {
		const active = button === pill;
		button.classList.toggle('is-active', active);
		button.setAttribute('aria-selected', active ? 'true' : 'false');
		button.tabIndex = active ? 0 : -1;
	});

	switcher.querySelectorAll('.rrze-directions__route-variant').forEach((panel) => {
		const active = panel.dataset.startKey === key;
		panel.classList.toggle('is-active', active);
		panel.hidden = !active;

		if (!active) {
			panel.querySelectorAll('.rrze-directions-route-map').forEach((map) => {
				destroyRouteMap(map);
			});
		}
	});

	const activePanel = switcher.querySelector(
		`.rrze-directions__route-variant[data-start-key="${key}"]`
	);
	if (activePanel) {
		initRouteMapsIn(activePanel);
	}
}

function focusSiblingPill(pill, directions) {
	const switcher = pill.closest('[data-start-switcher="1"]');
	if (!switcher) {
		return;
	}

	const pills = Array.from(switcher.querySelectorAll('.rrze-directions__start-pill'));
	const index = pills.indexOf(pill);
	if (index < 0) {
		return;
	}

	const nextIndex =
		directions === 'next'
			? (index + 1) % pills.length
			: (index - 1 + pills.length) % pills.length;
	const nextPill = pills[nextIndex];

	setActivePill(switcher, nextPill);
	nextPill.focus();
}

export function initStartPillsIn(root = document) {
	if (!root || typeof root.querySelectorAll !== 'function') {
		return;
	}

	root.querySelectorAll('[data-start-switcher="1"]').forEach((switcher) => {
		if (switcher.dataset.startSwitcherInit === '1') {
			return;
		}

		switcher.dataset.startSwitcherInit = '1';

		switcher.querySelectorAll('.rrze-directions__start-pill').forEach((pill) => {
			pill.addEventListener('click', () => {
				setActivePill(switcher, pill);
			});

			pill.addEventListener('keydown', (event) => {
				switch (event.key) {
					case 'ArrowRight':
					case 'ArrowDown':
						event.preventDefault();
						focusSiblingPill(pill, 'next');
						break;
					case 'ArrowLeft':
					case 'ArrowUp':
						event.preventDefault();
						focusSiblingPill(pill, 'prev');
						break;
					case 'Home':
						event.preventDefault();
						setActivePill(
							switcher,
							switcher.querySelector('.rrze-directions__start-pill')
						);
						switcher.querySelector('.rrze-directions__start-pill')?.focus();
						break;
					case 'End': {
						event.preventDefault();
						const pills = switcher.querySelectorAll('.rrze-directions__start-pill');
						const lastPill = pills[pills.length - 1];
						if (lastPill) {
							setActivePill(switcher, lastPill);
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
