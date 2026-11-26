const path = require('node:path');
const { transformFileSync } = require('@babel/core');
const commonjs = require('@babel/plugin-transform-modules-commonjs');
const jsx = require('@babel/plugin-transform-react-jsx');
function loadJsxModule(directory, relative, mocks) {
  const filename = path.resolve(directory, relative);
  const { code } = transformFileSync(filename, {
    babelrc: false, configFile: false,
    plugins: [commonjs, [jsx, { runtime: 'automatic' }]],
  });
  const module = { exports: {} };
  const element = (type, props, key) => ({ type, props, key });
  const requireMock = (name) => name === 'react/jsx-runtime'
    ? { jsx: element, jsxs: element, Fragment: 'Fragment' }
    : Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : require(name);
  new Function('require', 'module', 'exports', code)(requireMock, module, module.exports);
  return module.exports;
}
module.exports = { loadJsxModule };
