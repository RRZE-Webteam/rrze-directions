/**
 * Direction block accordion (single-open).
 * Uses rrze-direction-specific class names so rrze-elements global accordion.js ignores us.
 */
(function () {
	'use strict';

	const ROOT_SELECTOR = '.rrze-direction__accordions .rrze-direction__accordion';
	const TOGGLE_SELECTOR = '.rrze-direction__accordion-toggle';
	const PANEL_SELECTOR = '.rrze-direction__accordion-panel';

	function getPanel(group) {
		return group.querySelector(PANEL_SELECTOR);
	}

	function setPanelOpen(panel, toggle, open) {
		panel.classList.toggle('open', open);
		panel.hidden = !open;
		toggle.classList.toggle('active', open);
		toggle.setAttribute('aria-expanded', open ? 'true' : 'false');

		panel.dispatchEvent(
			new CustomEvent('rrze-direction-accordion-panel', {
				bubbles: true,
				detail: { open },
			})
		);
	}

	function togglePanel(toggle, accordion) {
		const group = toggle.closest('.rrze-direction__accordion-group');
		if (!group) {
			return;
		}

		const panel = getPanel(group);
		if (!panel) {
			return;
		}

		const willOpen = !toggle.classList.contains('active');

		accordion.querySelectorAll('.rrze-direction__accordion-group').forEach((other) => {
			if (other === group) {
				return;
			}
			const otherToggle = other.querySelector(TOGGLE_SELECTOR);
			const otherPanel = getPanel(other);
			if (otherToggle && otherPanel) {
				setPanelOpen(otherPanel, otherToggle, false);
			}
		});

		setPanelOpen(panel, toggle, willOpen);
	}

	function initAccordion(accordion) {
		if (accordion.dataset.rrzeAccordionInit === '1') {
			return;
		}
		accordion.dataset.rrzeAccordionInit = '1';

		accordion.querySelectorAll('.rrze-direction__accordion-group').forEach((group) => {
			const toggle = group.querySelector(TOGGLE_SELECTOR);
			const panel = getPanel(group);
			if (!toggle || !panel) {
				return;
			}

			const open = panel.classList.contains('open');
			setPanelOpen(panel, toggle, open);

			toggle.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				togglePanel(toggle, accordion);
			});
		});
	}

	function boot() {
		document.querySelectorAll(ROOT_SELECTOR).forEach(initAccordion);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();
