import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import './style.scss';

registerBlockType('rrze/directions', {
	edit: Edit,
	save: () => null,
});
