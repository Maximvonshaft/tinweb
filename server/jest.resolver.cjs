module.exports = (request, options) => {
  const resolve = options.defaultResolver;
  if (request.startsWith('.') && request.endsWith('.js')) {
    const tsRequest = request.replace(/\.js$/, '.ts');
    try {
      return resolve(tsRequest, options);
    } catch (err) {
      // fall back to original request if TS version not found
    }
  }
  return resolve(request, options);
};
