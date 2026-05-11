import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import './style.scss';

registerBlockType('rrze/direction', {
	edit: Edit,
	save: () => null,
});
