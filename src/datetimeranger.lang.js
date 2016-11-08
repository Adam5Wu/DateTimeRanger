// datetimeranger.lang.js
// author : Zhenyu Wu
// license : MIT
// https://adam5wu.github.io/DateTimeRanger/
(function (factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['jquery'], factory);
	} else if (typeof exports === 'object' && typeof module !== 'undefined') {
		// CommonJS. Register as a module
		module.exports = factory(require('jquery'));
	} else {
		// Browser globals
		factory(jQuery);
	}
}
	(function ($) {
		'use strict';
		$.DTRLang = $.extend({
				'cn' : 'zh-cn',
				'zh-cn' : //simplified chinese
				{
					'from': '从',
					'to': '到',
					'days': '天',
					'select': '请选择日期时间范围',
					'start': '开始',
					'end': '结束'
				},
			}, $.DTRLang);
	}));
