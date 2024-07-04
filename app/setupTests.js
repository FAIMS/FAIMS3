window.setImmediate = (fn) => {
    setTimeout(fn, 0);
};
window.process.nextTick = (fn) => {
    setTimeout(fn, 0);
};