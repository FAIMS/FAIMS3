// See https://github.com/davidbanham/express-async-errors - this patches
// express to handle async errors without hanging or needing an explicit try
// catch block

// Refactored to make this run as a function to avoid optimisation of require
// making the function only run once
const Layer = require('express/lib/router/layer');
const Router = require('express/lib/router');

const last = (arr = []) => arr[arr.length - 1];
const noop = Function.prototype;

function copyFnProps(oldFn, newFn) {
  Object.keys(oldFn).forEach(key => {
    newFn[key] = oldFn[key];
  });
  return newFn;
}

function wrap(fn) {
  const newFn = function newFn(...args) {
    const ret = fn.apply(this, args);
    const next = (args.length === 5 ? args[2] : last(args)) || noop;
    if (ret && ret.catch) ret.catch(err => next(err));
    return ret;
  };
  Object.defineProperty(newFn, 'length', {
    value: fn.length,
    writable: false,
  });
  return copyFnProps(fn, newFn);
}

function patchRouterParam() {
  const originalParam = Router.prototype.constructor.param;
  // @ts-ignore
  Router.prototype.constructor.param = function param(name, fn) {
    fn = wrap(fn);
    return originalParam.call(this, name, fn);
  };
}

// Idempotent: Vitest setupFiles may load this before expressSetup imports it.
if (!Layer.prototype.__faimsAsyncPatched) {
  Object.defineProperty(Layer.prototype, 'handle', {
    configurable: true,
    enumerable: true,
    get() {
      return this.__handle;
    },
    set(fn) {
      fn = wrap(fn);
      this.__handle = fn;
    },
  });
  Object.defineProperty(Layer.prototype, '__faimsAsyncPatched', {
    value: true,
    configurable: true,
  });
}

module.exports = patchRouterParam;
module.exports.default = patchRouterParam;
