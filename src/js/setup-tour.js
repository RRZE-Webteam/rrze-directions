/**
 * Contextual setup tour for RRZE Direction settings.
 */
import { createPortal, useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { SetupTourStepPanel } from './setup-tour-step';

function getSetupSteps() {
	return [
		{
			id: 'openroute-api-key',
			target: '[data-rrze-tour="openroute-api-key"]',
			title: __( 'OpenRouteService API key', 'rrze-direction' ),
			text: __(
				'Request a free API key from openrouteservice.org and paste it here. It is required for route directions and interactive route maps in the block.',
				'rrze-direction'
			),
		},
		{
			id: 'route-start',
			target: '[data-rrze-tour="route-start"]',
			title: __( 'Route start', 'rrze-direction' ),
			text: __(
				'Draft routes are always generated from Erlangen Hauptbahnhof, Nürnberg Hauptbahnhof, and Nürnberg Flughafen.',
				'rrze-direction'
			),
		},
		{
			id: 'save-settings',
			target: '[data-rrze-tour="save-settings"]',
			title: __( 'Save settings', 'rrze-direction' ),
			text: __(
				'Click Save changes to store your API key. Changing the key clears cached OpenRouteService responses.',
				'rrze-direction'
			),
		},
		{
			id: 'api-cache',
			target: '[data-rrze-tour="api-cache"]',
			title: __( 'API cache', 'rrze-direction' ),
			text: __(
				'Responses from karte.fau.de, OpenRouteService, and FAUdir are cached permanently for faster page loads.',
				'rrze-direction'
			),
		},
		{
			id: 'clear-cache',
			target: '[data-rrze-tour="clear-cache"]',
			title: __( 'Clear API cache', 'rrze-direction' ),
			text: __(
				'Use this button after changing addresses or map data if the frontend still shows outdated routes or map pins.',
				'rrze-direction'
			),
			optional: true,
		},
		{
			id: 'block-editor',
			target: '[data-rrze-tour="block-editor"]',
			title: __( 'RRZE Direction block', 'rrze-direction' ),
			text: __(
				'Insert the RRZE Direction block in the editor, choose a person and workplace from FAUdir, and pick accordion, tabs, columns, or dropdown for the directions layout.',
				'rrze-direction'
			),
		},
	];
}

function dismissSetupTour() {
	if ( typeof rrzeDirectionGuide === 'undefined' ) {
		return Promise.resolve();
	}

	const body = new FormData();
	body.append( 'action', 'rrze_direction_dismiss_setup_tour' );
	body.append( 'nonce', rrzeDirectionGuide.setupTourNonce );

	return fetch( rrzeDirectionGuide.ajaxUrl, {
		method: 'POST',
		body,
		credentials: 'same-origin',
	} );
}

function findStepTarget( step ) {
	return document.querySelector( step.target );
}

const SPOTLIGHT_PADDING = 8;
const TOUR_TARGET_CLASS = 'rrze-direction-setup-tour__target';

function clearTourTargetMarkers() {
	document
		.querySelectorAll( `.${ TOUR_TARGET_CLASS }` )
		.forEach( ( element ) => {
			element.classList.remove( TOUR_TARGET_CLASS );
		} );
}

function markTourTarget( element ) {
	clearTourTargetMarkers();

	if ( element ) {
		element.classList.add( TOUR_TARGET_CLASS );
	}
}

function getCutoutClipPath( rect ) {
	const right = rect.left + rect.width;
	const bottom = rect.top + rect.height;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;

	return `polygon(
		0px 0px,
		${ viewportWidth }px 0px,
		${ viewportWidth }px ${ viewportHeight }px,
		0px ${ viewportHeight }px,
		0px 0px,
		${ rect.left }px ${ rect.top }px,
		${ rect.left }px ${ bottom }px,
		${ right }px ${ bottom }px,
		${ right }px ${ rect.top }px,
		${ rect.left }px ${ rect.top }px
	)`;
}

function getSpotlightRect( element ) {
	if ( ! element ) {
		return null;
	}

	const rect = element.getBoundingClientRect();
	if ( rect.width <= 0 || rect.height <= 0 ) {
		return null;
	}

	const pad = SPOTLIGHT_PADDING;

	return {
		top: Math.max( 0, rect.top - pad ),
		left: Math.max( 0, rect.left - pad ),
		width: rect.width + pad * 2,
		height: rect.height + pad * 2,
	};
}

function SetupTourSpotlight( { rect, onClose, closeLabel } ) {
	if ( ! rect ) {
		return (
			<button
				type="button"
				className="rrze-direction-setup-tour__overlay"
				aria-label={ closeLabel }
				onClick={ onClose }
			/>
		);
	}

	return (
		<>
			<button
				type="button"
				className="rrze-direction-setup-tour__overlay-panel rrze-direction-setup-tour__overlay-panel--cutout"
				style={ { clipPath: getCutoutClipPath( rect ) } }
				aria-label={ closeLabel }
				onClick={ onClose }
			/>
			<div
				className="rrze-direction-setup-tour__spotlight"
				style={ {
					top: rect.top,
					left: rect.left,
					width: rect.width,
					height: rect.height,
				} }
				aria-hidden="true"
			/>
		</>
	);
}

function resolveGlobalStepIndex( steps, stepId ) {
	if ( stepId ) {
		const resolved = steps.findIndex( ( step ) => step.id === stepId );

		return resolved >= 0 ? resolved : 0;
	}

	return 0;
}

function isStepTargetVisible( step ) {
	return Boolean( findStepTarget( step ) );
}

function findNextStepIndex( steps, fromIndex ) {
	let index = fromIndex + 1;

	while ( index < steps.length ) {
		const step = steps[ index ];

		if ( ! step.optional || isStepTargetVisible( step ) ) {
			return index;
		}

		index++;
	}

	return fromIndex;
}

function findPreviousStepIndex( steps, fromIndex ) {
	let index = fromIndex - 1;

	while ( index >= 0 ) {
		const step = steps[ index ];

		if ( ! step.optional || isStepTargetVisible( step ) ) {
			return index;
		}

		index--;
	}

	return fromIndex;
}

export function SetupTour( { initialStepId = '', onClose } ) {
	const allSteps = useMemo( getSetupSteps, [] );
	const [ globalStepIndex, setGlobalStepIndex ] = useState( () =>
		resolveGlobalStepIndex( allSteps, initialStepId )
	);
	const [ spotlightRect, setSpotlightRect ] = useState( null );

	const currentStep = allSteps[ globalStepIndex ];
	const totalSteps = allSteps.length;
	const stepNumber = globalStepIndex + 1;

	const syncAnchor = useCallback( () => {
		if ( ! currentStep ) {
			clearTourTargetMarkers();
			setSpotlightRect( null );
			return;
		}

		const target = findStepTarget( currentStep );

		if ( ! target ) {
			clearTourTargetMarkers();
			setSpotlightRect( null );
			return;
		}

		markTourTarget( target );
		setSpotlightRect( getSpotlightRect( target ) );
		target.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
	}, [ currentStep ] );

	useEffect( () => {
		let frameId = window.requestAnimationFrame( () => {
			syncAnchor();
		} );

		const onLayoutChange = () => {
			window.cancelAnimationFrame( frameId );
			frameId = window.requestAnimationFrame( () => {
				syncAnchor();
			} );
		};

		window.addEventListener( 'resize', onLayoutChange );
		window.addEventListener( 'scroll', onLayoutChange, true );

		return () => {
			window.cancelAnimationFrame( frameId );
			window.removeEventListener( 'resize', onLayoutChange );
			window.removeEventListener( 'scroll', onLayoutChange, true );
			clearTourTargetMarkers();
		};
	}, [ syncAnchor, globalStepIndex ] );

	const finishTour = () => {
		dismissSetupTour();
		onClose?.();

		const url = new URL( window.location.href );
		url.searchParams.delete( 'rrze_setup_tour' );
		url.searchParams.delete( 'rrze_setup_tour_step' );
		window.history.replaceState( {}, '', url.toString() );
	};

	if ( ! currentStep || totalSteps === 0 ) {
		return null;
	}

	const nextStepIndex = findNextStepIndex( allSteps, globalStepIndex );
	const isLast = nextStepIndex === globalStepIndex;

	const handleNext = () => {
		if ( isLast ) {
			finishTour();
			return;
		}

		setGlobalStepIndex( findNextStepIndex( allSteps, globalStepIndex ) );
	};

	return createPortal(
		<>
			<SetupTourSpotlight
				rect={ spotlightRect }
				onClose={ finishTour }
				closeLabel={ __( 'Close setup tour', 'rrze-direction' ) }
			/>
			<div
				className="rrze-direction-setup-tour__card"
				role="dialog"
				aria-modal="true"
				aria-label={ currentStep.title }
			>
				<SetupTourStepPanel
					stepNumber={ stepNumber }
					totalSteps={ totalSteps }
					title={ currentStep.title }
					text={ currentStep.text }
					showPrevious={ globalStepIndex > 0 }
					isLast={ isLast }
					nextLabel={ __( 'Next', 'rrze-direction' ) }
					onPrevious={ () =>
						setGlobalStepIndex(
							findPreviousStepIndex( allSteps, globalStepIndex )
						)
					}
					onSkip={ finishTour }
					onNext={ handleNext }
				/>
			</div>
		</>,
		document.body
	);
}
