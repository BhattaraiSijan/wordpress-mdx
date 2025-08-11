// src/shims/next-router.js

/**
 * Minimal next/router shim object with push/replace and event stubs.
 * Acts like a singleton router instance.
 */
const events = {
  _handlers: {},
  on(name, cb) {
    if (!this._handlers[name]) this._handlers[name] = [];
    this._handlers[name].push(cb);
  },
  off(name, cb) {
    if (!this._handlers[name]) return;
    this._handlers[name] = this._handlers[name].filter(h => h !== cb);
  },
  emit(name, ...args) {
    (this._handlers[name] || []).forEach(cb => {
      try { cb(...args); } catch (e) { /* ignore */ }
    });
  }
};

const Router = {
  push(url, as, options) { console.log('[next/router shim] push', url, as, options); events.emit('routeChangeStart', url); },
  replace(url, as, options) { console.log('[next/router shim] replace', url, as, options); events.emit('routeChangeStart', url); },
  pathname: '/',
  query: {},
  asPath: '/',
  events,
};

export default Router;
