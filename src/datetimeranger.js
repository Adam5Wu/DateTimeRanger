// datetimeranger.js
// author : Zhenyu Wu
// license : MIT
// https://adam5wu.github.io/DateTimeRanger/
(function (factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['jquery', 'moment', 'daterange-picker-ex', 'timedropper-ex'], factory);
	} else if (typeof exports === 'object' && typeof module !== 'undefined') {
		// CommonJS. Register as a module
		module.exports = factory(require('jquery'), require('moment'),
				require('daterange-picker-ex'), require('timedropper-ex'));
	} else {
		// Browser globals
		factory(jQuery, moment);
	}
}
	(function ($, moment) {
		'use strict';
		$.fn.dateTimeRanger = function (opt) {
			$.DTRLang = $.extend({
					'default': 'en',
					'en': {
						'from': 'From',
						'to': 'To',
						'days': 'Days',
						'select': 'Please pick a date time range',
						'start': 'Start',
						'end': 'End'
					}
				}, $.DTRLang);

			opt = $.extend({
					autoStart: false,
					alwaysOpen: false,
					dropTrigger: true,
					summaryFmt: 'LLL',
					minDispFmt: 'YYYY/M/D H:mm',
					language: undefined,
					startOfWeek: undefined,
					dateRange: {
						start: false,
						end: false
					},
					minDays: 0,
					maxDays: 0,
					container: undefined,
					//singleDateTime: false,
					showWeekNumbers: false,
					getWeekNumber: function (date) {
						//date will be the first day of a week
						return moment(date).format('w');
					},
					showDayFilter: undefined,
					autoSwitch: true,
					meridians: true,
					mousewheel: true,
					showLancets: true,
					startFrom: "hr",
					handleShake: false,
					stickyMinute: 20,
					stickyHour: 8 * 60
				}, opt);

			if (opt.dateRange.start && opt.dateRange.start.constructor == String)
				opt.dateRange.start = moment(opt.dateRange.start, opt.format).toDate();
			if (opt.dateRange.end && opt.dateRange.end.constructor == String)
				opt.dateRange.end = moment(opt.dateRange.end, opt.format).toDate();
			if (opt.alwaysOpen) {
				opt.autoStart = true;
				opt.dropTrigger = false;
			}
			RangeReverseFix(opt.dateRange);

			var state = {
				anchor: $(this),
				wrapper: undefined,
				el: {},

				locale: 'default',
				localizer: {},
				fblocalizer: {},
				formatter: moment(),

				selRange: {
					start: false,
					end: false
				},
				followTime: {
					start: false,
					end: false
				},
				selDelay: null,

				active: false
			};

			// Public APIs
			state.anchor.data('DTR', {
				open: function (duration) {
					statusCheck();
					return openDatePicker(duration)
				},
				close: function (duration) {
					statusCheck();
					return closeDatePicker(duration);
				},
				setStart: function (d1, notime, silent) {
					statusCheck(true);
					if (d1.constructor == String)
						d1 = moment(d1, opt.format).toDate();
					setRangeStart('api', d1, notime, silent);
					return this;
				},
				setEnd: function (d2, notime, silent) {
					statusCheck(true);
					if (d2.constructor == String)
						d2 = moment(d2, opt.format).toDate();
					setRangeEnd('api', d2, notime, silent);
					return this;
				},
				setRange: function (d1, notime1, d2, notime2, silent) {
					statusCheck(true);
					if (d1.constructor == String)
						d1 = moment(d1, opt.format).toDate();
					if (d2.constructor == String)
						d2 = moment(d2, opt.format).toDate();
					setRange('api', d1, notime1, d2, notime2, silent);
				},
				clear: function (silent) {
					statusCheck();
					return clearSelection('api', silent);
				},
				wrapper: function () {
					statusCheck(true);
					return state.wrapper;
				},
				anchor: function () {
					statusCheck();
					return state.anchor;
				},
				redraw: function () {
					statusCheck();
					if (state.wrapper)
						redrawDTRanger();
				},
				resetMonthsView: function () {
					statusCheck();
					if (state.wrapper)
						resetMonthsView();
				},
				isActive: function () {
					statusCheck();
					return state.active;
				},
				destroy: function () {
					statusCheck();

					state.anchor.trigger('DTR-destroy', {});

					state.anchor.off('click');
					state.anchor.data('DTR', undefined);

					if (state.wrapper)
						state.wrapper.remove();
					state.wrapper = null;

					$(document).off('click', defocusClick);
				}
			});

			if (opt.dropTrigger) {
				state.anchor.on('click', function (evt) {
					openDatePicker(opt.animationTime);
				});
			}
			if (opt.alwaysOpen)
				setTimeout(openDatePicker.bind(this), 0);

			_init();
			return this;

			function _init() {
				// Initialize locale
				var localizer = ResolveLocalizer(state.locale);
				var fblocale = localizer[0];
				state.fblocalizer = localizer[1];

				var locale = state.locale;
				if (!opt.language) {
					var languages = navigator.languages || navigator.userLanguage ||
						(navigator.language ? [navigator.language] : [navigator.browserLanguage]);
					for (var idx in languages) {
						var lang = languages[idx].toLowerCase();
						if (lang in $.DTRLang) {
							locale = lang;
							break;
						}
					}
				} else if (opt.language in $.DTRLang)
					locale = opt.language;

				localizer = ResolveLocalizer(locale);
				state.locale = localizer[0];
				state.localizer = localizer[1];

				var _locale = state.formatter.locale();
				if (!opt.language || state.formatter.locale(opt.language).locale() !== opt.language) {
					if (state.formatter.locale(state.locale).locale() !== state.locale)
						if (state.formatter.locale(locale).locale() !== locale)
							if (state.formatter.locale(fblocale).locale() !== fblocale)
								state.formatter.locale(_locale);
				}

				state.wrapper = createDom($('.dt-ranger').length);
				(opt.container || state.anchor).append(state.wrapper);

				state.el['default_bar'] = state.wrapper.find('.default-bar');
				state.el['summary_bar'] = state.wrapper.find('.summary-bar');
				state.el['summary_start'] = state.el.summary_bar.find('.start-dt');
				state.el['summary_end'] = state.el.summary_bar.find('.end-dt');
				state.el['summary_span'] = state.el.summary_bar.find('.span-days');
				state.el['oper_zone'] = state.wrapper.find('.oper-zone');
				state.el['start_zone'] = state.el.oper_zone.find('.start-zone');
				state.el['start_inputs'] = state.el.start_zone.find('input');
				state.el['start_input_date'] = state.el.start_zone.find('input.date');
				state.el['start_input_time'] = state.el.start_zone.find('input.time');
				state.el['start_pickers'] = state.el.start_zone.find('.pickers');
				state.el['end_zone'] = state.el.oper_zone.find('.end-zone');
				state.el['end_inputs'] = state.el.end_zone.find('input');
				state.el['end_input_date'] = state.el.end_zone.find('input.date');
				state.el['end_input_time'] = state.el.end_zone.find('input.time');
				state.el['end_pickers'] = state.el.end_zone.find('.pickers');

				state['start_datepicker'] = state.el.start_pickers.dateRangePicker({
						inline: true,
						alwaysOpen: true,
						autoCloase: true,
						watchValueChange: false,
						language: opt.language,
						getValue: function () {},
						setValue: function (s) {},
						container: state.el.start_pickers,
						singleMonth: true,
						singleDate: true,
						haveTopbar: false,
						startOfWeek: opt.startOfWeek,
						dateRange: opt.dateRange,
						minDays: opt.minDays,
						maxDays: opt.maxDays,
						showWeekNumbers: opt.showWeekNumbers,
						getWeekNumber: opt.getWeekNumber,
						beforeShowDay: opt.showDayFilter
					}).data('DRPEx');
				state['start_timepicker'] = state.el.start_pickers.timeDropper({
						inline: true,
						alwaysOpen: true,
						watchValueChange: false,
						language: opt.language,
						fetchTime: function () {},
						putTime: function (s) {},
						startFrom: null,
						container: state.el.start_pickers,
						autoSwitch: opt.autoSwitch,
						meridians: opt.meridians,
						mousewheel: opt.mousewheel,
						showLancets: opt.showLancets,
						handleShake: opt.handleShake,
						stickyMinute: opt.stickyMinute,
						stickyHour: opt.stickyHour
					}).data('TDEx');

				state['end_datepicker'] = state.el.end_pickers.dateRangePicker({
						inline: true,
						alwaysOpen: true,
						autoCloase: true,
						watchValueChange: false,
						language: opt.language,
						getValue: function () {},
						setValue: function (s) {},
						container: state.el.end_pickers,
						singleMonth: true,
						singleDate: true,
						lookBehind: true,
						haveTopbar: false,
						startOfWeek: opt.startOfWeek,
						dateRange: opt.dateRange,
						minDays: opt.minDays,
						maxDays: opt.maxDays,
						showWeekNumbers: opt.showWeekNumbers,
						getWeekNumber: opt.getWeekNumber,
						beforeShowDay: opt.showDayFilter
					}).data('DRPEx');
				state['end_timepicker'] = state.el.end_pickers.timeDropper({
						inline: true,
						alwaysOpen: true,
						watchValueChange: false,
						language: opt.language,
						fetchTime: function () {},
						putTime: function (s) {},
						startFrom: null,
						container: state.el.end_pickers,
						autoSwitch: opt.autoSwitch,
						meridians: opt.meridians,
						mousewheel: opt.mousewheel,
						showLancets: opt.showLancets,
						handleShake: opt.handleShake,
						stickyMinute: opt.stickyMinute,
						stickyHour: opt.stickyHour
					}).data('TDEx');

				function inputValidityCheck(input) {
					if (!input.validity.valid) {
						for (var invalItem in input.validity) {
							if (input.validity[invalItem]) {
								$(input).attr('title', "Invalid value: " + invalItem.replace(/[A-Z]/g, function (char, index) {
										return '-' + char.toLowerCase();
									}));
								break;
							}
						}
						$(input).addClass('invalid');
						return invalItem;
					}
					$(input).removeClass('invalid');
					$(input).removeAttr('title');
					//return undefined;
				}

				var inputChangeTimer = null;
				var inputScanners = {};
				function scheduleInputScan(tag, el, method) {
					clearTimeout(inputChangeTimer);
					inputScanners[tag] = [el, method];
					inputChangeTimer = setTimeout(function () {
							inputChangeTimer = null;
							for (var t in inputScanners) {
								var scanner = inputScanners[t];
								scanner[1](scanner[0]);
							}
							inputScanners = {};
						}, 200);
				}

				// Start date & time interactions
				state.el.start_pickers.on('DRPEx-apply', function (event, obj) {
					//console.log('start-date-pick', obj);
					uiSetStartDate('picker', obj.date);
					if (opt.autoSwitch) {
						setTimeout(function () {
							state.start_timepicker.select(opt.startFrom);
						}, 0);
					}

					if (state.selDelay)
						clearTimeout(state.selDelay);

					state.selDelay = setTimeout(function () {
							state.selDelay = null;
						}, 100);
				}).on('TDEx-update', function (event, obj) {
					// Do not update when dailing
					if (obj.dailing)
						return;

					// Do not auto-update if input is changing
					if (obj.now && inputScanners['start-time'])
						return;

					//console.log('start-time-pick', obj);
					uiSetStartTime('picker', obj.time[0], obj.now);
				}).on('TDEx-dailing', function (event, obj) {
					if (obj.finish) {
						//console.log('start-time-dailed', obj);
						var time = state.start_timepicker.getTime();
						uiSetStartTime('picker', time[0], false);

						if (state.selDelay)
							clearTimeout(state.selDelay);

						state.selDelay = setTimeout(function () {
								state.selDelay = null;
							}, 100);
					}
				});
				state.el.start_input_date.on('input', function (event) {
					scheduleInputScan('start-date', this, function (el) {
						var invalItem = inputValidityCheck(el);
						if (invalItem) {
							//console.log('start-date-input-invalid', invalItem);
							return;
						}
						//console.log('start-date-input', el.valueAsDate);
						var locDate = el.valueAsDate;
						var utcDate = moment(new Date(locDate.getUTCFullYear(), locDate.getUTCMonth(), locDate.getUTCDate())).toDate();
						uiSetStartDate('input', utcDate);
					});
				});
				state.el.start_input_time.on('input', function (event) {
					scheduleInputScan('start-time', this, function (el) {
						var invalItem = inputValidityCheck(el);
						if (invalItem) {
							//console.log('start-time-input-invalid', invalItem);
							return;
						}
						//console.log('start-time-input', el.value);
						uiSetStartTime('input', el.valueAsNumber / 1000, false);
					});
				});

				// End date & time interactions
				state.el.end_pickers.on('DRPEx-apply', function (event, obj) {
					//console.log('end-date-pick', obj);
					uiSetEndDate('picker', obj.date);
					if (opt.autoSwitch) {
						setTimeout(function () {
							state.end_timepicker.select(opt.startFrom);
						}, 0);
					}

					if (state.selDelay)
						clearTimeout(state.selDelay);

					state.selDelay = setTimeout(function () {
							state.selDelay = null;
						}, 100);
				}).on('TDEx-update', function (event, obj) {
					// Do not update when dailing
					if (obj.dailing)
						return;

					// Do not auto-update if input is changing
					if (obj.now && inputScanners['end-time'])
						return;

					//console.log('end-time-pick', obj);
					uiSetEndTime('picker', obj.time[0], obj.now);
				}).on('TDEx-dailing', function (event, obj) {
					if (obj.finish) {
						//console.log('end-time-dailed', obj);
						var time = state.end_timepicker.getTime();
						uiSetEndTime('picker', time[0], false);

						if (state.selDelay)
							clearTimeout(state.selDelay);

						state.selDelay = setTimeout(function () {
								state.selDelay = null;
							}, 100);
					}
				});
				state.el.end_input_date.on('input', function (event) {
					scheduleInputScan('end-date', this, function (el) {
						var invalItem = inputValidityCheck(el);
						if (invalItem) {
							//console.log('end-date-input-invalid', invalItem);
							return;
						}
						//console.log('end-date-input', el.valueAsDate);
						var locDate = el.valueAsDate;
						var utcDate = moment(new Date(locDate.getUTCFullYear(), locDate.getUTCMonth(), locDate.getUTCDate())).toDate();
						uiSetEndDate('input', utcDate);
					});
				});
				state.el.end_input_time.on('input', function (event) {
					scheduleInputScan('end-time', this, function (el) {
						var invalItem = inputValidityCheck(el);
						if (invalItem) {
							//console.log('end-time-input-invalid', invalItem);
							return;
						}
						//console.log('end-time-input', el.value);
						uiSetEndTime('input', el.valueAsNumber / 1000, false);
					});
				});

				// Focus related handling
				function inputBlurCheck(el, source, range) {
					if (!el.validity.valid) {
						selRangeChange(['picker', source], range, true);
						inputValidityCheck(el);
					}
				}

				state.el.start_input_date.on('blur', function (event) {
					inputBlurCheck(this, 'date', [true, false]);
				});
				state.el.start_input_date.attr('focusNext', state.el.start_input_time);
				state.el.start_input_time.on('blur', function (event) {
					inputBlurCheck(this, 'time', [true, false]);
				});
				state.el.start_input_time.attr('focusNext', state.el.end_input_date);
				state.el.end_input_date.on('blur', function (event) {
					inputBlurCheck(this, 'date', [false, true]);
				});
				state.el.end_input_date.attr('focusNext', state.el.end_input_time);
				state.el.end_input_time.on('blur', function (event) {
					inputBlurCheck(this, 'time', [false, true]);
				});
				state.el.end_input_time.attr('focusNext', state.el.start_input_time);

				state.el.start_zone.on('click', function (event) {
					if (!clickContained(event, state.el.start_inputs[0]) &&
						!clickContained(event, state.el.start_inputs[1]) &&
						!clickContained(event, state.el.start_pickers[0]))
						state.el.start_input_date[0].focus();
				});
				state.el.start_zone.on('mouseenter', function (event) {
					state.el.start_input_date[0].focus();
				});
				state.el.end_zone.on('click', function (event) {
					if (!clickContained(event, state.el.end_inputs[0]) &&
						!clickContained(event, state.el.end_inputs[1]) &&
						!clickContained(event, state.el.end_pickers[0]))
						state.el.end_input_date[0].focus();
				});
				state.el.end_zone.on('mouseenter', function (event) {
					state.el.end_input_date[0].focus();
				});

				function inputKeyUp(keyCode, el, source, range) {
					switch (keyCode) {
					case 13: // Enter
						if (!el.validity.valid) {
							//el.value = null;
							selRangeChange(['picker', source], range, true);
							inputValidityCheck(el);
							return;
						}
						el.focusNext.focus();
						break;
					case 27: // Esc
						var clearTarget = '';
						if (range[0]) {
							state.selRange.start = false;
							clearTarget += 'start';
						}
						if (range[1]) {
							state.selRange.end = false;
							clearTarget += 'end';
						}
						selRangeChange(['internal', 'clear-' + clearTarget], range);
						inputValidityCheck(el);
						break;
					}
				}

				state.el.start_input_date.on('keyup', function (event) {
					//console.log('start-date-input-keyup', event.keyCode);
					inputKeyUp(event.keyCode, this, 'date', [true, false]);
				});
				state.el.start_input_time.on('keyup', function (event) {
					//console.log('start-time-input-keyup', event.keyCode);
					inputKeyUp(event.keyCode, this, 'time', [true, false]);
				});
				state.el.end_input_date.on('keyup', function (event) {
					//console.log('end-date-input-keyup', event.keyCode);
					inputKeyUp(event.keyCode, this, 'date', [false, true]);
				});
				state.el.end_input_time.on('keyup', function (event) {
					//console.log('end-time-input-keyup', event.keyCode);
					inputKeyUp(event.keyCode, this, 'time', [false, true]);
				});

				//...
			}

			function statusCheck(initialized) {
				if (!state.wrapper) {
					if (state.wrapper !== undefined)
						throw new Error('Already destroyed');
					if (initialized)
						throw new Error('Not yet initialized');
				}
			}

			function ResolveLocalizer(locale) {
				var localizer = $.DTRLang[locale];
				// Resolve aliases
				while (localizer.constructor === String) {
					locale = localizer;
					localizer = $.DTRLang[localizer];
				}
				return [locale, localizer];
			}

			function localize(t) {
				return state.localizer[t] || state.fblocalizer[t] || '??';
			}

			function isRangeReversed(range) {
				if (range.start && range.end)
					return moment(range.start).isAfter(moment(range.end));
				return null;
			}
			function RangeReverseFix(range) {
				if (isRangeReversed(range)) {
					var temp = range.end;
					range.end = range.start;
					range.start = temp;
					return true;
				}
				return false;
			}
			function selRangeReverseFix(range) {
				if (RangeReverseFix(range)) {
					// Also reverse follow time attributes
					var followTime_start = state.followTime.start;
					state.followTime.start = state.followTime.end;
					state.followTime.end = followTime_start;
					return true;
				}
				return false;
			}

			function clickContained(evt, container) {
				return container.contains(evt.target) || evt.target == container;
			}

			function defocusClick(evt) {
				if (!state.selDelay) {
					if (!clickContained(evt, state.anchor[0]) && !clickContained(evt, state.wrapper[0]))
						closeDatePicker(opt.animationTime);
				}
			}

			function openDatePicker(duration) {
				if (!state.active) {
					state.active = true;

					// Temporarily toggle display style for accurate dimension calculations
					state.el.oper_zone.css({
						display: 'block',
						visibility: 0
					});
					state.start_datepicker.redraw();
					state.end_datepicker.redraw();
					state.el.oper_zone.css({
						display: 'none',
						visibility: 'initial'
					});

					var afterAnim = function () {
						state.anchor.trigger('DTR-opened', {
							anchor: state.anchor,
							wrapper: state.wrapper
						});
					};
					state.el.default_bar.slideUp(duration);
					state.el.summary_bar.slideUp(duration);
					state.el.oper_zone.slideDown(duration, afterAnim);

					if (!opt.alwaysOpen)
						$(document).bind('click.DTR', defocusClick);

					state.anchor.trigger('DTR-open', {
						anchor: state.anchor,
						wrapper: state.wrapper
					});
					return true;
				}
				return false;
			}

			function closeDatePicker(duration) {
				if (!opt.alwaysOpen && state.active) {
					state.active = false;
					var afterAnim = function () {
						state.anchor.trigger('DTR-closed', {
							anchor: state.anchor,
							wrapper: state.wrapper
						});
					};

					if (state.selRange.start && state.selRange.end)
						state.el.summary_bar.slideDown(duration);
					else
						state.el.default_bar.slideDown(duration);

					state.el.oper_zone.slideUp(duration, afterAnim);

					state.anchor.trigger('DTR-close', {
						anchor: state.anchor,
						wrapper: state.wrapper
					});
					if (!opt.alwaysOpen)
						$(document).unbind('click.DTR', defocusClick);
					return true;
				}
				return false;
			}

			function updateInput(datetime, date_input, time_input, followTime) {
				var dStr = null,
				tStr = null;
				if (datetime) {
					// var dtStr = moment(datetime).format('YYYY-MM-DDTHH:mm:ss.sss');
					var dtStr = moment(datetime).format('YYYY-MM-DDTHH:mm');
					dStr = dtStr.substr(0, 10);
					tStr = dtStr.substr(11, 5);
				}
				if (date_input)
					date_input.val(dStr);
				if (time_input) {
					time_input.val(tStr);

					if (followTime && tStr)
						time_input.addClass('floating');
					else
						time_input.removeClass('floating');
				}
			}

			function updateTimePicker(datetime, time_picker) {
				if (datetime) {
					var time = datetime.getHours() * 3600 + datetime.getMinutes() * 60
						 + datetime.getSeconds() + datetime.getMilliseconds() / 1000;
					time_picker.setTime(time);
				} else {
					time_picker.setTime(null);
				}
			}

			function updateDatePickers(datetimes, date_pickers) {
				if (datetimes) {
					var dateStart = moment(datetimes[0]).startOf('day').toDate();
					var dateEnd = moment(datetimes[1]).startOf('day').toDate();
					date_pickers.forEach(function (picker) {
						picker.setRange(dateStart, dateEnd, true);
					});
				} else {
					date_pickers.forEach(function (picker) {
						picker.clear(true);
					});
				}
			}

			function getDateTimeString(d, fmt) {
				state.formatter.toDate().setTime(d);
				return state.formatter.format(fmt);
			}

			function selRangeChange(source, range, silent) {
				var DatePickerUpdate = true;
				if (range[0]) {
					switch (source[0]) {
					case 'picker':
						switch (source[1]) {
						case 'time':
							DatePickerUpdate = !state.el.start_input_date.val();
						default:
							updateInput(state.selRange.start,
								source[1] == 'date' || !state.el.start_input_date.val() ? state.el.start_input_date : null,
								source[1] == 'time' || !state.el.start_input_time.val() ? state.el.start_input_time : null,
								state.followTime.start);
							break;
						}
						break;
					case 'input':
						switch (source[1]) {
						case 'time':
							updateTimePicker(state.selRange.start, state.start_timepicker);
							if (!state.el.start_input_date.val())
								updateInput(state.selRange.start, state.el.start_input_date, null);
							DatePickerUpdate = false;
							break;
						case 'date':
							if (!state.el.start_input_time.val())
								updateInput(state.selRange.start, null, state.el.start_input_time, state.followTime.start);
							break;
						}
						break;
					default:
						updateInput(state.selRange.start, state.el.start_input_date, state.el.start_input_time, state.followTime.start);
						updateTimePicker(state.followTime.start ? false : state.selRange.start, state.start_timepicker);
					}
					var timeStr = getDateTimeString(state.selRange.start, opt.summaryFmt);
					state.el.summary_start.text(timeStr);
				}
				if (range[1]) {
					switch (source[0]) {
					case 'picker':
						switch (source[1]) {
						case 'time':
							DatePickerUpdate = !state.el.end_input_date.val();
						default:
							updateInput(state.selRange.end,
								source[1] == 'date' || !state.el.end_input_date.val() ? state.el.end_input_date : null,
								source[1] == 'time' || !state.el.end_input_time.val() ? state.el.end_input_time : null,
								state.followTime.end);
							break;
						}
						break;
					case 'input':
						switch (source[1]) {
						case 'time':
							updateTimePicker(state.selRange.end, state.end_timepicker);
							if (!state.el.end_input_date.val())
								updateInput(state.selRange.end, state.el.end_input_date, null);
							DatePickerUpdate = false;
							break;
						case 'date':
							if (!state.el.end_input_time.val())
								updateInput(state.selRange.end, null, state.el.end_input_time, state.followTime.end);
							break;
						}
						break;
					default:
						updateInput(state.selRange.end, state.el.end_input_date, state.el.end_input_time, state.followTime.end);
						updateTimePicker(state.followTime.end ? false : state.selRange.end, state.end_timepicker);
					}
					var timeStr = getDateTimeString(state.selRange.end, opt.summaryFmt);
					state.el.summary_end.text(timeStr);
				}
				if (DatePickerUpdate) {
					if (state.selRange.start) {
						if (state.selRange.end) {
							updateDatePickers([state.selRange.start, state.selRange.end],
								[state.start_datepicker, state.end_datepicker]);
						} else {
							updateDatePickers([state.selRange.start, state.selRange.start],
								[state.start_datepicker]);
							updateDatePickers(false, [state.end_datepicker]);
						}
					} else {
						if (state.selRange.end) {
							updateDatePickers(false, [state.start_datepicker]);
							updateDatePickers([state.selRange.end, state.selRange.end],
								[state.end_datepicker]);
						} else {
							updateDatePickers(false, [state.start_datepicker, state.end_datepicker]);
						}
					}
				}
				if (state.selRange.start && state.selRange.end) {
					var daySpan = moment(state.selRange.end).diff(state.selRange.start, 'day', true);
					state.el.summary_span.text(Math.abs(Math.round(daySpan * 100) / 100));
				}

				if (!silent) {
					var event_payload = {
						'source': source,
					};
					if (state.selRange.start)
						event_payload['start'] = new Date(state.selRange.start);
					if (state.selRange.end)
						event_payload['end'] = new Date(state.selRange.end);

					state.anchor.trigger('DTR-change', event_payload);
				}
			}

			function uiSetStartDate(source, date) {
				var Update = false;

				var datetime = state.selRange.start;
				if (!datetime) {
					Update = true;

					datetime = state.selRange.start = new Date();
					var time = state.start_timepicker.getTime();
					datetime.setHours(Math.floor(time[0] / 3600))
					var hs = time[0] % 3600;
					datetime.setMinutes(Math.floor(hs / 60));
					//datetime.setSeconds(Math.floor(hs % 60));
					datetime.setSeconds(0);
					//datetime.setMilliseconds((hs % 1).toFixed(3) * 1000);
					datetime.setMilliseconds(0);
				}

				if (!Update) {
					Update = ((datetime.getFullYear() != date.getFullYear()) ||
						(datetime.getMonth() != date.getMonth()) ||
						(datetime.getDate() != date.getDate()));
				}

				if (Update) {
					datetime.setFullYear(date.getFullYear());
					datetime.setMonth(date.getMonth());
					datetime.setDate(date.getDate());

					selRangeChange([source, 'date'], [true, false]);
					if (selRangeReverseFix(state.selRange))
						selRangeChange(['internal', 'range-reverse'], [true, true]);
				}
			}

			function uiSetStartTime(source, time, now) {
				var Update = state.followTime.start != now;
				state.followTime.start = now;

				var datetime = state.selRange.start;
				if (!datetime) {
					// If selection has not been made, do not auto-update time
					if (now)
						return;

					Update = true;

					datetime = state.selRange.start = new Date();
					var date = state.start_datepicker.getDateRange();
					if (date) {
						datetime.setFullYear(date[1].getFullYear());
						datetime.setMonth(date[1].getMonth());
						datetime.setDate(date[1].getDate());
					}
				}
				var newHr = Math.floor(time / 3600);
				var hs = time % 3600;
				var newMin = Math.floor(hs / 60);
				//var newSec = Math.floor(hs % 60);
				var newSec = 0;
				//var newMSec = (hs % 1).toFixed(3) * 1000;
				var newMSec = 0;

				// Do not update if value not changed
				if (!Update) {
					Update = ((datetime.getHours() != newHr) ||
						(datetime.getMinutes() != newMin) ||
						(datetime.getSeconds() != newSec) ||
						(datetime.getMilliseconds() != newMSec));
				}

				if (Update) {
					datetime.setHours(newHr)
					datetime.setMinutes(newMin);
					datetime.setSeconds(newSec);
					datetime.setMilliseconds(newMSec);

					selRangeChange([source, 'time'], [true, false]);
					if (selRangeReverseFix(state.selRange))
						selRangeChange(['internal', 'range-reverse'], [true, true]);
				}
			}

			function setRangeStart(source, datetime, notime, silent) {
				state.selRange.start = datetime;
				state.followTime.start = notime;

				selRangeChange([source, 'set-rangestart'], [true, selRangeReverseFix(state.selRange)]);
			}

			function uiSetEndDate(source, date) {
				var Update = false;

				var datetime = state.selRange.end;
				if (!datetime) {
					Update = true;

					datetime = state.selRange.end = new Date();
					var time = state.end_timepicker.getTime();
					datetime.setHours(Math.floor(time[0] / 3600))
					var hs = time[0] % 3600;
					datetime.setMinutes(Math.floor(hs / 60));
					//datetime.setSeconds(Math.floor(hs % 60));
					datetime.setSeconds(0);
					//datetime.setMilliseconds((hs % 1).toFixed(3) * 1000);
					datetime.setMilliseconds(0);
				}

				if (!Update) {
					Update = ((datetime.getFullYear() != date.getFullYear()) ||
						(datetime.getMonth() != date.getMonth()) ||
						(datetime.getDate() != date.getDate()));
				}

				if (Update) {
					datetime.setFullYear(date.getFullYear());
					datetime.setMonth(date.getMonth());
					datetime.setDate(date.getDate());

					selRangeChange([source, 'date'], [false, true]);
					if (selRangeReverseFix(state.selRange))
						selRangeChange(['internal', 'range-reverse'], [true, true]);
				}
			}

			function uiSetEndTime(source, time, now) {
				var Update = state.followTime.end != now;
				state.followTime.end = now;

				var datetime = state.selRange.end;
				if (!datetime) {
					// If selection has not been made, do not auto-update time
					if (now)
						return;

					Update = true;

					datetime = state.selRange.end = new Date();
					var date = state.end_datepicker.getDateRange();
					if (date) {
						datetime.setFullYear(date[1].getFullYear());
						datetime.setMonth(date[1].getMonth());
						datetime.setDate(date[1].getDate());
					}
				}
				var newHr = Math.floor(time / 3600);
				var hs = time % 3600;
				var newMin = Math.floor(hs / 60);
				//var newSec = Math.floor(hs % 60);
				var newSec = 0;
				//var newMSec = (hs % 1).toFixed(3) * 1000;
				var newMSec = 0;

				// Do not update if value not changed
				if (!Update) {
					Update = ((datetime.getHours() != newHr) ||
						(datetime.getMinutes() != newMin) ||
						(datetime.getSeconds() != newSec) ||
						(datetime.getMilliseconds() != newMSec));
				}

				if (Update) {
					datetime.setHours(newHr)
					datetime.setMinutes(newMin);
					datetime.setSeconds(newSec);
					datetime.setMilliseconds(newMSec);

					selRangeChange([source, 'time'], [false, true]);
					if (selRangeReverseFix(state.selRange))
						selRangeChange(['internal', 'range-reverse'], [true, true]);
				}
			}

			function setRangeEnd(source, datetime, notime, silent) {
				state.selRange.end = datetime;
				state.followTime.end = notime;

				selRangeChange([source, 'set-rangeend'], [selRangeReverseFix(state.selRange), true]);
			}

			function setRange(source, datetime1, notime1, datetime2, notime2, silent) {
				state.selRange.start = datetime1;
				state.followTime.start = notime1;
				state.selRange.end = datetime2;
				state.followTime.end = notime2;

				selRangeReverseFix(state.selRange);
				selRangeChange([source, 'set-range'], [true, true]);
			}

			function clearSelection(source, silent) {
				if (state.selRange.start || state.selRange.end) {
					state.selRange.start = false;
					state.selRange.end = false;
					selRangeChange([source, 'clear-selection'], [true, true]);
					return true;
				}
				return false;
			}

			function resetMonthsView() {
				state.start_input_date.resetView();
				state.end_input_date.resetView();
			}

			function redrawDTRanger() {
				state.start_input_date.redraw();
				state.end_input_date.redraw();
			}

			// Open tag: content === undefined
			// Open+Close: content.constructor === String
			function tagGen(name, attrs, content) {
				var Ret = '<' + name;
				if (attrs) {
					$.each(attrs, function (attrKey, attrVal) {
						if (attrVal.constructor == Array)
							attrVal = attrVal.reduce(function (t, e) {
									return (t || '') + (e ? ' ' + e : '');
								});
						Ret += ' ' + attrKey + '="' + attrVal + '"';
					});
					if (content !== undefined)
						Ret += (content ? '>' + content + '</' + name : '/');
				}
				return Ret + '>';
			}

			function createDom(index) {
				var html =
					tagGen('div', {
						'class': ['dt-ranger'],
						id: 'dt-ranger-' + index
					});

				html += tagGen('div', {
					'class': 'default-bar'
				}, tagGen('i', {
						'class': ['fa', 'fa-hand-pointer-o'],
						'aria-hidden': 'true'
					}, '')
					 + localize('select'));

				html += tagGen('div', {
					'class': 'summary-bar'
				}, tagGen('span', {}, localize('from'))
					 + ' ' + tagGen('b', {
						'class': 'start-dt'
					}, '[start datetime]') + ' '
					 + tagGen('span', {}, localize('to'))
					 + ' ' + tagGen('b', {
						'class': 'end-dt'
					}, '[end datetime]') + ' '
					 + tagGen('i', {},
						'(' + tagGen('span', {
							'class': 'span-days'
						}, 'X') + ' '
						 + localize('days') + ')'));

				html += tagGen('div', {
					'class': 'oper-zone'
				}, tagGen('div', {
						'class': 'start-zone'
					}, tagGen('label', {},
							localize('start') + ':'
							 + tagGen('div', {
								'class': 'input-wrapper'
							}, tagGen('input', {
									'class': 'date',
									'type': 'date',
									'min': '2000-01-01',
									'max': '3000-01-01'
								})
								 + tagGen('input', {
									'class': 'time',
									'type': 'time'
								})))
						 + tagGen('div', {
							'class': 'pickers'
						}, ''))
					 + tagGen('div', {
						'class': 'end-zone'
					}, tagGen('label', {},
							localize('end') + ':'
							 + tagGen('div', {
								'class': 'input-wrapper'
							}, tagGen('input', {
									'class': 'date',
									'type': 'date',
									'min': '2000-01-01',
									'max': '3000-01-01'
								})
								 + tagGen('input', {
									'class': 'time',
									'type': 'time'
								})))
						 + tagGen('div', {
							'class': 'pickers'
						}, '')));

				html += tagGen('/div');
				return $(html);
			}
		};
	}));
