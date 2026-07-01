import { Dashicon } from '@wordpress/components';

const iconClass = 'rrze-directions__pill-icon rrze-directions__pill-icon--svg';

function SvgIcon({ viewBox, children }) {
	return (
		<svg
			className={iconClass}
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
		<SvgIcon viewBox="0 0 512 512">
			<path
				fill="currentColor"
				d="M384 32h-64a16 16 0 0 0-16-16h-96a16 16 0 0 0-16 16h-64c-16 0-32 16-32 32v288c0 23.92 160 80 160 80s160-56.74 160-80V64c0-16-16-32-32-32M256 352a48 48 0 1 1 48-48a48 48 0 0 1-48 48m112-152a8 8 0 0 1-8 8H152a8 8 0 0 1-8-8v-80a8 8 0 0 1 8-8h208a8 8 0 0 1 8 8Z"
			/>
			<path
				fill="currentColor"
				d="m314 432l15.32 16H182.58L198 432l-32-13l-76.62 77h45.2l16-16h210.74l16 16h45.3l-76.36-77.75z"
			/>
		</SvgIcon>
	);
}

function TrainStartIcon() {
	return <TransitModeIcon />;
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
			return <TrainStartIcon />;
		default:
			return <Dashicon className="rrze-directions__pill-icon" icon="location" />;
	}
}
