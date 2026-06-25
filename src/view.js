/**
 * Accordion behaviour aligned with rrze-answers (single-open details + slide animation).
 * Used when rrze-answers is not active; otherwise rrze-answers-accordion is enqueued instead.
 */
(function ($) {
	'use strict';

	function setHeaderVar() {
		const h =
			document.getElementById('site-navigation')?.getBoundingClientRect()
				.height || 0;
		document.documentElement.style.setProperty(
			'--header-height',
			`${Math.ceil(h)}px`
		);
	}

	setHeaderVar();
	window.addEventListener('resize', setHeaderVar);
	window.addEventListener('load', setHeaderVar);

	$(function () {
		$('.rrze-direction__directions[data-accordion="single"]').each(function () {
			const $group = $(this);
			const $items = $group.find('details.rrze-answers-item');
			const scrollOffset = parseInt(
				$group.attr('data-scroll-offset') || '0',
				10
			);

			function byId(id) {
				try {
					return $('#' + CSS.escape(id));
				} catch (e) {
					return $(
						'#' +
							id.replace(
								/([ !"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g,
								'\\$1'
							)
					);
				}
			}

			function getContent($details) {
				return $details.children().not('summary');
			}

			function setOpen($details, shouldOpen, animate) {
				const $content = getContent($details);

				if (shouldOpen) {
					$details.attr('open', 'open');
					if (animate) {
						$content.stop(true, true).slideDown(400);
					} else {
						$content.stop(true, true).show();
					}
					return;
				}

				if (animate) {
					$content.stop(true, true).slideUp(400, function () {
						$details.removeAttr('open');
					});
				} else {
					$content.stop(true, true).hide();
					$details.removeAttr('open');
				}
			}

			function closeSiblings($except, animate) {
				$items.not($except).each(function () {
					const $d = $(this);
					if ($d.prop('open')) {
						setOpen($d, false, animate);
					}
				});
			}

			function openItem($target, animate) {
				setOpen($target, true, animate);
				closeSiblings($target, animate);

				if ($target.attr('id')) {
					history.replaceState(null, null, '#' + $target.attr('id'));
				}
			}

			function openByHash(doScroll) {
				const raw = window.location.hash || '';
				if (!raw) {
					return false;
				}

				const id = decodeURIComponent(raw.replace(/^#/, ''));
				if (!id) {
					return false;
				}

				const $el = byId(id);
				if (!$el.length) {
					return false;
				}

				let $target = $el.closest('details.rrze-answers-item');
				if (!$target.length && $el.is('details.rrze-answers-item')) {
					$target = $el;
				}
				if (!$target.length || !$group.has($target).length) {
					return false;
				}

				openItem($target, true);

				const $sum = $target.children('summary').first();
				if ($sum.length) {
					try {
						$sum.trigger('focus');
					} catch (e) {
						// ignore
					}
				}

				if (doScroll) {
					const top = $target.offset().top - scrollOffset;
					$('html, body')
						.stop(true)
						.animate({ scrollTop: Math.max(0, top) }, 300);
				}

				return true;
			}

			$items.each(function () {
				const $d = $(this);
				const $content = getContent($d);
				if ($d.prop('open')) {
					$content.show();
				} else {
					$content.hide();
				}
			});

			if (!openByHash(false)) {
				const $firstOpen = $items.filter('[open]').first();
				if ($firstOpen.length) {
					closeSiblings($firstOpen, false);
					setOpen($firstOpen, true, false);
				}
			}

			$items.each(function () {
				const $d = $(this);
				const $summary = $d.children('summary');

				function toggleItem() {
					if ($d.prop('open')) {
						setOpen($d, false, true);
					} else {
						openItem($d, true);
					}
				}

				$summary.on('click', function (e) {
					e.preventDefault();
					toggleItem();
				});

				$summary.on('keydown', function (e) {
					if (e.key === ' ' || e.key === 'Enter') {
						e.preventDefault();
						toggleItem();
					}
				});
			});

			$(window).on('hashchange', function () {
				openByHash(true);
			});
		});
	});
})(jQuery);
