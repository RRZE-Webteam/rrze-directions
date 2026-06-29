/**
 * RRZE Directions admin tours: About guide + contextual setup tour.
 */
import { useEffect, useState } from '@wordpress/element';
import { render } from '@wordpress/element';
import { Guide } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { SetupTour } from './setup-tour';
import '../sass/rrze-directions-admin.scss';

function GuideIcon( { dashicon } ) {
	return (
		<div className="rrze-directions-guided-tour__icon" aria-hidden="true">
			<span className={ `dashicons ${ dashicon }` } />
		</div>
	);
}

function dismissTour() {
	if ( typeof rrzeDirectionsGuide === 'undefined' ) {
		return Promise.resolve();
	}

	const body = new FormData();
	body.append( 'action', 'rrze_directions_dismiss_guided_tour' );
	body.append( 'nonce', rrzeDirectionsGuide.nonce );

	return fetch( rrzeDirectionsGuide.ajaxUrl, {
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
			'rrze-directions-start-guided-tour'
		);
		const setupButton = document.getElementById(
			'rrze-directions-start-setup-tour'
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
		typeof rrzeDirectionsGuide !== 'undefined' && rrzeDirectionsGuide.githubUrl
			? rrzeDirectionsGuide.githubUrl
			: 'https://github.com/RRZE-Webteam/rrze-directions';

	const docuUrl =
		typeof rrzeDirectionsGuide !== 'undefined' && rrzeDirectionsGuide.docuUrl
			? rrzeDirectionsGuide.docuUrl
			: 'https://www.wp.rrze.fau.de/';

	const guidePages = [
		{
			image: <GuideIcon dashicon="dashicons-welcome-learn-more" />,
			content: (
				<>
					<h1 className="rrze-directions-guided-tour__heading">
						{ __( 'Welcome to RRZE Directions', 'rrze-directions' ) }
					</h1>
					<p className="rrze-directions-guided-tour__text">
						{ __(
							'This plugin adds an arrival block with FAUdir addresses, an embedded FAU map, and OpenRouteService directionss with interactive route maps.',
							'rrze-directions'
						) }
					</p>
				</>
			),
		},
		{
			image: <GuideIcon dashicon="dashicons-location" />,
			content: (
				<>
					<h1 className="rrze-directions-guided-tour__heading">
						{ __( 'FAUdir and maps', 'rrze-directions' ) }
					</h1>
					<p className="rrze-directions-guided-tour__text">
						{ __(
							'Select a person and workplace in the block editor. The plugin loads address data from FAUdir and embeds karte.fau.de with a location pin when possible.',
							'rrze-directions'
						) }
					</p>
				</>
			),
		},
		{
			image: <GuideIcon dashicon="dashicons-admin-site-alt3" />,
			content: (
				<>
					<h1 className="rrze-directions-guided-tour__heading">
						{ __( 'Routes and layouts', 'rrze-directions' ) }
					</h1>
					<p className="rrze-directions-guided-tour__text">
						{ __(
							'Walking, car, and public transport directionss can be shown as accordion, tabs, columns, or dropdown. Within each mode, pill buttons let visitors pick a starting point. Numbered steps link to the route map.',
							'rrze-directions'
						) }
					</p>
				</>
			),
		},
		{
			image: <GuideIcon dashicon="dashicons-admin-settings" />,
			content: (
				<>
					<h1 className="rrze-directions-guided-tour__heading">
						{ __( 'Settings and tour', 'rrze-directions' ) }
					</h1>
					<p className="rrze-directions-guided-tour__text">
						{ __(
							'Use the setup tour to configure your OpenRouteService API key and learn how caching works. The API key is required for automatic route generation.',
							'rrze-directions'
						) }
					</p>
				</>
			),
		},
		{
			image: <GuideIcon dashicon="dashicons-heart" />,
			content: (
				<>
					<h1 className="rrze-directions-guided-tour__heading">
						{ __( 'Feedback and open source', 'rrze-directions' ) }
					</h1>
					<p className="rrze-directions-guided-tour__text">
						{ __(
							'We welcome your feedback. Everyone who wants to contribute is invited to take part.',
							'rrze-directions'
						) }
					</p>
					<p className="rrze-directions-guided-tour__text">
						{ __( 'RRZE Directions is open source on', 'rrze-directions' ) }{ ' ' }
						<a
							href={ githubUrl }
							target="_self"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
						.
					</p>
					<p className="rrze-directions-guided-tour__text">
						<a
							href={ docuUrl }
							target="_self"
							rel="noopener noreferrer"
						>
							{ __( 'Documentation', 'rrze-directions' ) }
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
					className="rrze-directions-guided-tour"
					contentLabel={ __(
						'About RRZE Directions',
						'rrze-directions'
					) }
					finishButtonText={ __( 'Get started', 'rrze-directions' ) }
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

const root = document.getElementById( 'rrze-directions-guided-tour-root' );

if ( root && typeof rrzeDirectionsGuide !== 'undefined' ) {
	render(
		<ToursApp
			autoStartGuide={ rrzeDirectionsGuide.autoStart }
			autoStartSetup={ rrzeDirectionsGuide.autoStartSetup }
			setupTourStepId={ rrzeDirectionsGuide.setupTourStepId }
		/>,
		root
	);
}
