const SHIELD_CLASS = 'rrze-directions__map-wheel-shield';
const PASS_THROUGH_CLASS = 'is-pass-through';
const IFRAME_SELECTOR = 'iframe.rrze-directions__iframe';

function scrollPageFromWheel(event) {
	event.preventDefault();
	event.stopPropagation();

	window.scrollBy({
		top: event.deltaY,
		left: event.deltaX,
		behavior: 'auto',
	});
}

export function attachMapWheelShield(container) {
	if (!container || container.dataset.rrzeWheelShield === '1') {
		return;
	}

	if (getComputedStyle(container).position === 'static') {
		container.style.position = 'relative';
	}

	const iframe = container.querySelector(IFRAME_SELECTOR);

	const shield = document.createElement('div');
	shield.className = SHIELD_CLASS;
	shield.setAttribute('aria-hidden', 'true');
	container.appendChild(shield);
	container.dataset.rrzeWheelShield = '1';

	const enableMapInteraction = () => {
		shield.classList.add(PASS_THROUGH_CLASS);
		if (iframe) {
			iframe.style.pointerEvents = 'auto';
		}
	};

	const disableMapInteraction = () => {
		shield.classList.remove(PASS_THROUGH_CLASS);
		if (iframe) {
			iframe.style.pointerEvents = 'none';
			iframe.blur();
		}
	};

	if (iframe) {
		iframe.style.pointerEvents = 'none';
	}

	shield.addEventListener('wheel', scrollPageFromWheel, { passive: false });

	shield.addEventListener('mousedown', enableMapInteraction);
	shield.addEventListener('touchstart', enableMapInteraction, { passive: true });

	document.addEventListener('mouseup', disableMapInteraction);
	document.addEventListener('touchend', disableMapInteraction);
	document.addEventListener('touchcancel', disableMapInteraction);
	container.addEventListener('mouseleave', disableMapInteraction);
}

export function detachMapWheelShield(container) {
	if (!container) {
		return;
	}

	const iframe = container.querySelector(IFRAME_SELECTOR);
	if (iframe) {
		iframe.style.pointerEvents = '';
	}

	container.querySelector(`.${SHIELD_CLASS}`)?.remove();
	delete container.dataset.rrzeWheelShield;
}
