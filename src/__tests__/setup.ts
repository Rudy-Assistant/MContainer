// Polyfill requestAnimationFrame for Node test environment
(globalThis as any).requestAnimationFrame = (cb: () => void) => {
  cb();
  return 0;
};
(globalThis as any).cancelAnimationFrame = () => {};
