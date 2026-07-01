import { Dashicon } from '@wordpress/components';

const iconClass = 'rrze-directions__pill-icon rrze-directions__pill-icon--svg';

const TRAIN_FILLED_PATH =
	'M4 15.5V6q0-1.325.688-2.113t1.812-1.2t2.563-.55T12 2q1.65 0 3.113.138t2.55.55t1.712 1.2T20 6v9.5q0 1.475-1.012 2.488T16.5 19l1.5 1.5v.5h-2l-2-2h-4l-2 2H6v-.5L7.5 19q-1.475 0-2.488-1.012T4 15.5M6 10h5V7H6zm7 0h5V7h-5zm-3.425 5.575Q10 15.15 10 14.5t-.425-1.075T8.5 13t-1.075.425T7 14.5t.425 1.075T8.5 16t1.075-.425m7 0Q17 15.15 17 14.5t-.425-1.075T15.5 13t-1.075.425T14 14.5t.425 1.075T15.5 16t1.075-.425';

function SvgIcon({ viewBox, children, className = iconClass }) {
	return (
		<svg
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			viewBox={viewBox}
			aria-hidden="true"
			focusable="false"
		>
			{children}
		</svg>
	);
}

function BikeModeIcon() {
	return (
		<SvgIcon viewBox="0 0 24 24">
			<path
				fill="currentColor"
				d="M5 20.5A3.5 3.5 0 0 1 1.5 17A3.5 3.5 0 0 1 5 13.5A3.5 3.5 0 0 1 8.5 17A3.5 3.5 0 0 1 5 20.5M5 12a5 5 0 0 0-5 5a5 5 0 0 0 5 5a5 5 0 0 0 5-5a5 5 0 0 0-5-5m9.8-2H19V8.2h-3.2l-1.94-3.27c-.29-.5-.86-.83-1.46-.83c-.47 0-.9.19-1.2.5L7.5 8.29C7.19 8.6 7 9 7 9.5c0 .63.33 1.16.85 1.47L11.2 13v5H13v-6.5l-2.25-1.65l2.32-2.35m5.93 13a3.5 3.5 0 0 1-3.5-3.5a3.5 3.5 0 0 1 3.5-3.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m0-8.5a5 5 0 0 0-5 5a5 5 0 0 0 5 5a5 5 0 0 0 5-5a5 5 0 0 0-5-5m-3-7.2c1 0 1.8-.8 1.8-1.8S17 1.2 16 1.2S14.2 2 14.2 3S15 4.8 16 4.8"
			/>
		</SvgIcon>
	);
}

function CarModeIcon() {
	return (
		<SvgIcon viewBox="0 0 512 512">
			<path
				fill="currentColor"
				d="M447.68 220.78a16 16 0 0 0-1-3.08l-37.78-88.16C400.19 109.17 379 96 354.89 96H157.11c-24.09 0-45.3 13.17-54 33.54L65.29 217.7A15.7 15.7 0 0 0 64 224v176a16 16 0 0 0 16 16h32a16 16 0 0 0 16-16v-16h256v16a16 16 0 0 0 16 16h32a16 16 0 0 0 16-16V224a16 16 0 0 0-.32-3.22M144 320a32 32 0 1 1 32-32a32 32 0 0 1-32 32m224 0a32 32 0 1 1 32-32a32 32 0 0 1-32 32M104.26 208l28.23-65.85C136.11 133.69 146 128 157.11 128h197.78c11.1 0 21 5.69 24.62 14.15L407.74 208Z"
			/>
		</SvgIcon>
	);
}

function TransitModeIcon() {
	return (
		<SvgIcon viewBox="0 0 24 24">
			<path fill="currentColor" d={TRAIN_FILLED_PATH} />
		</SvgIcon>
	);
}

function StationStartIcon() {
	return (
		<SvgIcon
			viewBox="0 0 24 24"
			className={`${iconClass} rrze-directions__pill-icon--station`}
		>
			<rect
				x="1.5"
				y="1.5"
				width="21"
				height="21"
				rx="4"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<g transform="translate(12 12) scale(0.82) translate(-12 -12)">
				<path fill="currentColor" d={TRAIN_FILLED_PATH} />
			</g>
		</SvgIcon>
	);
}

export function DirectionModeIcon({ modeKey }) {
	switch (modeKey) {
		case 'car':
			return <CarModeIcon />;
		case 'bike':
			return <BikeModeIcon />;
		case 'transit':
			return <TransitModeIcon />;
		default:
			return null;
	}
}

export function StartPointIcon({ startKey }) {
	switch (startKey) {
		case 'nuernberg_airport':
			return <Dashicon className="rrze-directions__pill-icon" icon="airplane" />;
		case 'erlangen':
		case 'nuernberg':
			return <StationStartIcon />;
		default:
			return <Dashicon className="rrze-directions__pill-icon" icon="location" />;
	}
}
