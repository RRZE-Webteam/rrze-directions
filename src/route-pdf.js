import { jsPDF } from 'jspdf';
import {
	renderDetailMapImage,
	renderOverviewMapImage,
	tryCaptureLeafletMap,
} from './route-pdf-map';

function getViewStrings() {
	const config = window.rrze_directions_view;

	return {
		from: config?.from ?? 'From',
		to: config?.to ?? 'To',
		mode: config?.mode ?? 'Mode of transport',
		directions: config?.directions ?? 'Directions',
		destination: config?.destination ?? 'Destination',
		overviewMap: config?.overviewMap ?? 'Overview map',
		detailMap: config?.detailMap ?? 'Detail map',
		page: config?.page ?? 'Page',
		downloading: config?.downloading ?? 'Generating PDF…',
		downloadError: config?.downloadError ?? 'Could not generate the PDF.',
	};
}

function parseRouteData(routeMapEl) {
	const raw = routeMapEl.getAttribute('data-route');

	if (!raw) {
		return null;
	}

	try {
		const data = JSON.parse(raw);

		if (
			!data ||
			!Array.isArray(data.coordinates) ||
			data.coordinates.length < 2 ||
			!Array.isArray(data.steps)
		) {
			return null;
		}

		return data;
	} catch (error) {
		return null;
	}
}

function resolveDestinationLabel(routeMapEl, routeData) {
	const block = routeMapEl.closest('.rrze-directions');

	if (block?.dataset?.destinationLabel) {
		return block.dataset.destinationLabel.trim();
	}

	if (routeData?.destination?.label?.trim()) {
		return routeData.destination.label.trim();
	}

	const address = block?.querySelector('.rrze-directions__address');

	return address?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function resolveStartLabel(routeMapEl) {
	const fromAttr = routeMapEl.dataset.startLabel?.trim();

	if (fromAttr) {
		return fromAttr;
	}

	const routeVariant = routeMapEl.closest('.rrze-directions__route-variant');

	if (routeVariant) {
		const startKey = routeVariant.dataset.startKey;
		const switcher = routeMapEl.closest('[data-start-switcher]');
		const pill = switcher?.querySelector(
			`.rrze-directions__start-pill[data-start-key="${startKey}"]`
		);
		const label = pill?.querySelector('.rrze-directions__start-pill-label')?.textContent?.trim();

		if (label) {
			return label;
		}
	}

	return '';
}

function resolveModeLabel(routeMapEl) {
	const fromAttr = routeMapEl.dataset.modeLabel?.trim();

	if (fromAttr) {
		return fromAttr;
	}

	const modeVariant = routeMapEl.closest('[data-mode-key]');
	const key = modeVariant?.dataset?.modeKey;

	if (key) {
		const pill = routeMapEl
			.closest('.rrze-directions')
			?.querySelector(`.rrze-directions__mode-pill[data-mode-key="${key}"]`);

		if (pill?.getAttribute('aria-label')) {
			return pill.getAttribute('aria-label');
		}
	}

	const column = routeMapEl.closest('.rrze-directions__text--column');

	if (column) {
		const heading = column.querySelector('h3')?.textContent?.trim();

		if (heading) {
			return heading;
		}
	}

	const accordionToggle = routeMapEl
		.closest('.rrze-directions__accordion-item')
		?.querySelector('.rrze-directions__accordion-toggle');

	return accordionToggle?.textContent?.trim() ?? '';
}

function resolveDirectionsSteps(routeMapEl, routeData) {
	const panel = routeMapEl.parentElement;
	const listItems = panel?.querySelectorAll('.rrze-directions-ors-step');

	if (listItems?.length) {
		return Array.from(listItems, (item) => item.textContent?.trim() ?? '').filter(
			Boolean
		);
	}

	return routeData.steps.map((step) => step.instruction?.trim() ?? '').filter(Boolean);
}

function canvasToImageData(canvas) {
	if (!canvas || typeof canvas.toDataURL !== 'function') {
		return null;
	}

	try {
		const png = canvas.toDataURL('image/png');

		if (png && png.length > 100) {
			return { data: png, format: 'PNG' };
		}
	} catch (error) {
		// Tainted canvas from cross-origin map tiles.
	}

	try {
		const jpeg = canvas.toDataURL('image/jpeg', 0.92);

		if (jpeg && jpeg.length > 100) {
			return { data: jpeg, format: 'JPEG' };
		}
	} catch (error) {
		return null;
	}

	return null;
}

async function resolveOverviewMapImage(routeMapEl, routeData) {
	const captured = await tryCaptureLeafletMap(routeMapEl);
	const capturedImage = canvasToImageData(captured);

	if (capturedImage) {
		return capturedImage;
	}

	const rendered = await renderOverviewMapImage(routeData);
	const renderedImage = canvasToImageData(rendered);

	if (renderedImage) {
		return renderedImage;
	}

	throw new Error('overview map export failed');
}

async function resolveDetailMapImage(routeData) {
	const rendered = await renderDetailMapImage(routeData);
	const renderedImage = canvasToImageData(rendered);

	if (renderedImage) {
		return renderedImage;
	}

	throw new Error('detail map export failed');
}

function addMapSection(doc, { title, imageData, imageFormat, margin, contentWidth, y }) {
	const mapWidth = contentWidth;
	const mapHeight = mapWidth * 0.42;

	y = ensureSpace(doc, y, mapHeight + 10, margin);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(11);
	y = addWrappedText(doc, title, margin, y, contentWidth, 5);
	y += 2;
	doc.addImage(imageData, imageFormat, margin, y, mapWidth, mapHeight);

	return y + mapHeight + 6;
}

function sanitizeFilenamePart(value) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9äöüß]+/gi, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight) {
	const lines = doc.splitTextToSize(text, maxWidth);
	doc.text(lines, x, y);

	return y + lines.length * lineHeight;
}

function addLabelValueLine(doc, label, value, x, y, maxWidth, lineHeight) {
	const labelText = `${label}: `;

	doc.setFont('helvetica', 'bold');
	doc.text(labelText, x, y);

	const labelWidth = doc.getTextWidth(labelText);
	doc.setFont('helvetica', 'normal');

	const valueLines = doc.splitTextToSize(value, Math.max(maxWidth - labelWidth, 20));

	if (valueLines.length === 0) {
		return y + lineHeight;
	}

	doc.text(valueLines[0], x + labelWidth, y);

	let currentY = y + lineHeight;

	for (let index = 1; index < valueLines.length; index += 1) {
		doc.text(valueLines[index], x, currentY);
		currentY += lineHeight;
	}

	return currentY;
}

const FOOTER_RESERVE_MM = 12;

function ensureSpace(doc, y, needed, margin) {
	const pageHeight = doc.internal.pageSize.getHeight();

	if (y + needed > pageHeight - margin - FOOTER_RESERVE_MM) {
		doc.addPage();

		return margin;
	}

	return y;
}

function addPageFooters(doc, sourceUrl, strings, margin, contentWidth) {
	const pageCount = doc.internal.getNumberOfPages();
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const footerY = pageHeight - 8;

	for (let page = 1; page <= pageCount; page += 1) {
		doc.setPage(page);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);
		doc.setTextColor(90, 90, 90);

		doc.text(
			`${strings.page} ${page} / ${pageCount}`,
			pageWidth - margin,
			footerY,
			{ align: 'right' }
		);

		if (sourceUrl) {
			const urlLines = doc.splitTextToSize(sourceUrl, contentWidth * 0.72);

			doc.text(urlLines, margin, footerY);
		}

		doc.setTextColor(0, 0, 0);
	}
}

export async function downloadRoutePdf(routeMapEl) {
	const routeData = parseRouteData(routeMapEl);

	if (!routeData) {
		throw new Error('missing route data');
	}

	const strings = getViewStrings();
	const block = routeMapEl.closest('.rrze-directions');
	const baseTitle =
		block?.querySelector('.rrze-directions__title')?.textContent?.trim() ||
		strings.directions;
	const fromLabel = resolveStartLabel(routeMapEl);
	const toLabel = resolveDestinationLabel(routeMapEl, routeData);
	const modeLabel = resolveModeLabel(routeMapEl);
	const title = modeLabel ? `${baseTitle} (${modeLabel})` : baseTitle;
	const steps = resolveDirectionsSteps(routeMapEl, routeData);
	const sourceUrl = window.location?.href?.trim() ?? '';

	const overviewMap = await resolveDetailMapImage(routeData);
	const detailMap = await resolveOverviewMapImage(routeMapEl, routeData);

	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
	const margin = 16;
	const pageWidth = doc.internal.pageSize.getWidth();
	const contentWidth = pageWidth - margin * 2;
	let y = margin;

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(16);
	y = addWrappedText(doc, title, margin, y, contentWidth, 7);
	y += 4;

	doc.setFontSize(11);
	doc.setFont('helvetica', 'normal');

	if (fromLabel) {
		y = ensureSpace(doc, y, 6, margin);
		y = addLabelValueLine(
			doc,
			strings.from,
			fromLabel,
			margin,
			y,
			contentWidth,
			5
		);
		y += 2;
	}

	if (toLabel) {
		y = ensureSpace(doc, y, 6, margin);
		y = addLabelValueLine(doc, strings.to, toLabel, margin, y, contentWidth, 5);
		y += 4;
	}

	y = addMapSection(doc, {
		title: strings.overviewMap,
		imageData: overviewMap.data,
		imageFormat: overviewMap.format,
		margin,
		contentWidth,
		y,
	});

	y = addMapSection(doc, {
		title: strings.detailMap,
		imageData: detailMap.data,
		imageFormat: detailMap.format,
		margin,
		contentWidth,
		y,
	});

	if (steps.length) {
		y = ensureSpace(doc, y, 10, margin);
		doc.setFont('helvetica', 'bold');
		y = addWrappedText(doc, `${strings.directions}:`, margin, y, contentWidth, 5);
		y += 2;
		doc.setFont('helvetica', 'normal');

		steps.forEach((step, index) => {
			y = ensureSpace(doc, y, 8, margin);
			y = addWrappedText(
				doc,
				`${index + 1}. ${step}`,
				margin,
				y,
				contentWidth,
				5
			);
			y += 1;
		});
	}

	const filenameParts = ['route'];

	if (modeLabel) {
		filenameParts.push(sanitizeFilenamePart(modeLabel));
	}

	if (fromLabel) {
		filenameParts.push(sanitizeFilenamePart(fromLabel));
	}

	addPageFooters(doc, sourceUrl, strings, margin, contentWidth);

	doc.save(`${filenameParts.join('-') || 'route'}.pdf`);
}

export function initRoutePdfButtons(root = document) {
	root.querySelectorAll('[data-route-pdf="1"]').forEach((button) => {
		if (button.dataset.routePdfReady === '1') {
			return;
		}

		button.dataset.routePdfReady = '1';

		button.addEventListener('click', async () => {
			const routeMapEl = button.closest('.rrze-directions-route-map');

			if (!routeMapEl) {
				return;
			}

			const strings = getViewStrings();
			const originalLabel = button.textContent;

			button.disabled = true;
			button.textContent = strings.downloading;

			try {
				await downloadRoutePdf(routeMapEl);
			} catch (error) {
				if (typeof console !== 'undefined' && console.error) {
					console.error('RRZE Directions PDF export failed:', error);
				}
				window.alert(strings.downloadError);
			} finally {
				button.disabled = false;
				button.textContent = originalLabel;
			}
		});
	});
}
