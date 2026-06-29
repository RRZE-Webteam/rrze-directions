/**
 * RRZE Direction admin tours: About guide + contextual setup tour.
 */
import { useEffect, useState } from '@wordpress/element';
import { render } from '@wordpress/element';
import { Guide } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { SetupTour } from './setup-tour';
import '../sass/rrze-direction-admin.scss';

function GuideIcon( { dashicon } ) {
	return (
		<div className="rrze-direction-guided-tour__icon" aria-hidden="true">
			<span className={ `dashicons ${ dashicon }` } />
		</div>
	);
}

function dismissTour() {
	if ( typeof rrzeDirectionGuide === 'undefined' ) {
		return Promise.resolve();
	}

	const body = new FormData();
	body.append( 'action', 'rrze_direction_dismiss_guided_tour' );
	body.append( 'nonce', rrzeDirectionGuide.nonce );

	return fetch( rrzeDirectionGuide.ajaxUrl, {
		method: 'POST',
		body,
		credentials: 'same-origin',
	} );
}

function ToursApp( { autoStartGuide, autoStartSetup, setupTourStepId } ) {
	const setupTourActive =
		Boolean( autoStartSetup ) || setupTourStepId.length > 0;
	const [ guideOpen, setGuideOpen ] = useState(
		Boolean( autoStartGuide ) && ! setupTourActive
	);
	const [ setupOpen, setSetupOpen ] = useState( setupTourActive );
	const [ setupTourKey, setSetupTourKey ] = useState( 0 );
	const [ setupStepId, setSetupStepId ] = useState( setupTourStepId );

	useEffect( () => {
		const guideButton = document.getElementById(
			'rrze-direction-start-guided-tour'
		);
		const setupButton = document.getElementById(
			'rrze-direction-start-setup-tour'
		);

		const openGuide = () => {
			setSetupOpen( false );
			setGuideOpen( true );
		};
		const openSetup = () => {
			setGuideOpen( false );
			setSetupStepId( '' );
			setSetupTourKey( ( key ) => key + 1 );
			setSetupOpen( true );
		};

		guideButton?.addEventListener( 'click', openGuide );
		setupButton?.addEventListener( 'click', openSetup );

		return () => {
			guideButton?.removeEventListener( 'click', openGuide );
			setupButton?.removeEventListener( 'click', openSetup );
		};
	}, [] );

	const finishGuide = () => {
		setGuideOpen( false );
		dismissTour();
	};

	const githubUrl =
		typeof rrzeDirectionGuide !== 'undefined' && rrzeDirectionGuide.githubUrl
			? rrzeDirectionGuide.githubUrl
			: 'https://github.com/RRZE-Webteam/rrze-direction';

	const docuUrl =
		typeof rrzeDirectionGuide !== 'undefined' && rrzeDirectionGuide.docuUrl
			? rrzeDirectionGuide.docuUrl
			: 'https://www.wp.rrze.fau.de/';

	const guidePages = [
		{
			image: <GuideIcon dashicon="dashicons-welcome-learn-more" />,
			content: (
				<>
					<h1 className="rrze-direction-guided-tour__heading">
						{ __( 'Welcome to RRZE Direction', 'rrze-direction' ) }
					</h1>
					<p className="rrze-direction-guided-tour__text">
						{ __(
							'This plugin adds an arrival block with FAUdir addresses, an embedded FAU map, and OpenRouteService directions with interactive route maps.',
							'rrze-direction'
						) }
					</p>
				</>
			),
		},
		{
			image: <GuideIcon dashicon="dashicons-location" />,
			content: (
				<>
					<h1 className="rrze-direction-guided-tour__heading">
						{ __( 'FAUdir and maps', 'rrze-direction' ) }
					</h1>
					<p className="rrze-direction-guided-tour__text">
						{ __(
							'Select a person and workplace in the block editor. The plugin loads address data from FAUdir and embeds karte.fau.de with a location pin when possible.',
							'rrze-direction'
						) }
					</p>
				</>
			),
		},
		{
			image: <GuideIcon dashicon="dashicons-admin-site-alt3" />,
			content: (
				<>
					<h1 className="rrze-direction-guided-tour__heading">
						{ __( 'Routes and layouts', 'rrze-direction' ) }
					</h1>
					<p className="rrze-direction-guided-tour__text">
						{ __(
							'Walking, car, and public transport directions can be shown as accordion, tabs, columns, or dropdown. Within each mode, pill buttons let visitors pick a starting point. Numbered steps link to the route map.',
							'rrze-direction'
						) }
					</p>
				</>
			),
		},
		{
			image: <GuideIcon dashicon="dashicons-admin-settings" />,
			content: (
				<>
					<h1 className="rrze-direction-guided-tour__heading">
						{ __( 'Settings and tour', 'rrze-direction' ) }
					</h1>
					<p className="rrze-direction-guided-tour__text">
						{ __(
							'Use the setup tour to configure your OpenRouteService API key and learn how caching works. The API key is required for automatic route generation.',
							'rrze-direction'
						) }
					</p>
				</>
			),
		},
		{
			image: <GuideIcon dashicon="dashicons-heart" />,
			content: (
				<>
					<h1 className="rrze-direction-guided-tour__heading">
						{ __( 'Feedback and open source', 'rrze-direction' ) }
					</h1>
					<p className="rrze-direction-guided-tour__text">
						{ __(
							'We welcome your feedback. Everyone who wants to contribute is invited to take part.',
							'rrze-direction'
						) }
					</p>
					<p className="rrze-direction-guided-tour__text">
						{ __( 'RRZE Direction is open source on', 'rrze-direction' ) }{ ' ' }
						<a
							href={ githubUrl }
							target="_self"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
						.
					</p>
					<p className="rrze-direction-guided-tour__text">
						<a
							href={ docuUrl }
							target="_self"
							rel="noopener noreferrer"
						>
							{ __( 'Documentation', 'rrze-direction' ) }
						</a>
					</p>
				</>
			),
		},
	];

	return (
		<>
			{ guideOpen && (
				<Guide
					className="rrze-direction-guided-tour"
					contentLabel={ __(
						'About RRZE Direction',
						'rrze-direction'
					) }
					finishButtonText={ __( 'Get started', 'rrze-direction' ) }
					onFinish={ finishGuide }
					pages={ guidePages }
				/>
			) }
			{ setupOpen && (
				<SetupTour
					key={ setupTourKey }
					initialStepId={ setupStepId }
					onClose={ () => setSetupOpen( false ) }
				/>
			) }
		</>
	);
}

const root = document.getElementById( 'rrze-direction-guided-tour-root' );

if ( root && typeof rrzeDirectionGuide !== 'undefined' ) {
	render(
		<ToursApp
			autoStartGuide={ rrzeDirectionGuide.autoStart }
			autoStartSetup={ rrzeDirectionGuide.autoStartSetup }
			setupTourStepId={ rrzeDirectionGuide.setupTourStepId }
		/>,
		root
	);
}
