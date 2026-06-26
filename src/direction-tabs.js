/**
 * Tab behaviour aligned with RRZE Elements Blocks (TabsManual / rrze-tabs.js).
 */
import { initRouteMapsIn } from './route-map';

class DirectionTabsManual {
	constructor(tablistNode) {
		this.tablistNode = tablistNode;
		this.tabs = Array.from(tablistNode.querySelectorAll('[role=tab]'));
		this.tabpanels = [];
		this.firstTab = null;
		this.lastTab = null;

		this.tabs.forEach((tab) => {
			const tabpanel = document.getElementById(
				tab.getAttribute('aria-controls') ?? ''
			);
			tab.tabIndex = -1;
			tab.setAttribute('aria-selected', 'false');
			this.tabpanels.push(tabpanel);

			tab.addEventListener('keydown', this.onKeydown.bind(this));
			tab.addEventListener('click', this.onClick.bind(this));

			if (!this.firstTab) {
				this.firstTab = tab;
			}
			this.lastTab = tab;
		});

		if (this.firstTab) {
			this.setSelectedTab(this.firstTab);
		}
	}

	setSelectedTab(currentTab) {
		this.tabs.forEach((tab, index) => {
			const panel = this.tabpanels[index];
			if (currentTab === tab) {
				tab.setAttribute('aria-selected', 'true');
				tab.removeAttribute('tabindex');
				panel?.classList.remove('is-hidden');
				if (panel) {
					initRouteMapsIn(panel);
				}
			} else {
				tab.setAttribute('aria-selected', 'false');
				tab.tabIndex = -1;
				panel?.classList.add('is-hidden');
			}
		});
	}

	moveFocusToTab(currentTab) {
		currentTab.focus();
	}

	moveFocusToPreviousTab(currentTab) {
		if (currentTab === this.firstTab) {
			this.moveFocusToTab(this.lastTab);
			return;
		}

		const index = this.tabs.indexOf(currentTab);
		this.moveFocusToTab(this.tabs[index - 1]);
	}

	moveFocusToNextTab(currentTab) {
		if (currentTab === this.lastTab) {
			this.moveFocusToTab(this.firstTab);
			return;
		}

		const index = this.tabs.indexOf(currentTab);
		this.moveFocusToTab(this.tabs[index + 1]);
	}

	onKeydown(event) {
		const target = event.currentTarget;
		let handled = false;

		switch (event.key) {
			case 'ArrowLeft':
				this.moveFocusToPreviousTab(target);
				handled = true;
				break;
			case 'ArrowRight':
				this.moveFocusToNextTab(target);
				handled = true;
				break;
			case 'Home':
				this.moveFocusToTab(this.firstTab);
				handled = true;
				break;
			case 'End':
				this.moveFocusToTab(this.lastTab);
				handled = true;
				break;
			default:
				break;
		}

		if (handled) {
			event.stopPropagation();
			event.preventDefault();
		}
	}

	onClick(event) {
		this.setSelectedTab(event.currentTarget);
	}
}

export function initDirectionTabsIn(root = document) {
	if (!root || typeof root.querySelectorAll !== 'function') {
		return;
	}

	root.querySelectorAll(
		'.rrze-direction .rrze-elements-tabs [role=tablist].manual'
	).forEach((tablist) => {
		const tabsRoot = tablist.closest('.rrze-elements-tabs');
		if (tabsRoot?.dataset.externalTabsScript === '1') {
			return;
		}

		if (tablist.dataset.directionTabsInit === '1') {
			return;
		}

		tablist.dataset.directionTabsInit = '1';
		new DirectionTabsManual(tablist);
	});
}
