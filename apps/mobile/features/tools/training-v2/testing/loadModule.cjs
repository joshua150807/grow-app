const path = require('node:path');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadModule(fromDirectory, relativePath, mocks = {}) {
  const filename = path.resolve(fromDirectory, relativePath);
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const module = { exports: {} };
  const localRequire = (request) => (
    Object.prototype.hasOwnProperty.call(mocks, request) ? mocks[request] : require(request)
  );

  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire,
    module,
    module.exports,
    filename,
    path.dirname(filename),
  );
  return module.exports;
}

module.exports = { loadModule };
