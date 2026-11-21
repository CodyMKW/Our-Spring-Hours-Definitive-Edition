/* shim.js — the tiny "browser" the story code expects, for QuickJS on the 3DS (and the desktop test harness).
   The host (C) provides: __store_get(key) -> string|undefined, __store_set(key, str), __store_del(key), __log(str). */
var window = globalThis;
window.window = window; window.self = window;
window.addEventListener = function () {};
window.setInterval = function () { return 0; };
window.clearInterval = function () {};
window.setTimeout = function () { return 0; };
window.clearTimeout = function () {};
window.document = { readyState: "complete", addEventListener: function () {}, getElementById: function () { return null; } };
window.localStorage = {
  getItem: function (k) { var v = __store_get(String(k)); return v === undefined ? null : v; },
  setItem: function (k, v) { __store_set(String(k), String(v)); },
  removeItem: function (k) { __store_del(String(k)); },
};
var localStorage = window.localStorage;
window.console = {
  log: function () { __log(Array.prototype.join.call(arguments, " ")); },
  warn: function () { __log("warn: " + Array.prototype.join.call(arguments, " ")); },
  error: function () { __log("error: " + Array.prototype.join.call(arguments, " ")); },
};
var console = window.console;
