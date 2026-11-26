const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// packages/shared is consumed via its "react-native" source entry (src/index.ts) so
// Metro bundles the Zod schemas directly. That source uses transitive ESM-style
// imports with explicit ".js" extensions (e.g. "./training/plans.js") pointing at
// ".ts" files, which Metro cannot resolve on its own. Only fall back to the ".ts"
// sibling when the request originates from inside packages/shared/src and the
// default resolution actually fails, so nothing else is affected.
const sharedSrcDir = path.join(__dirname, '..', '..', 'packages', 'shared', 'src');

function isTransitiveSharedJsImport(context, moduleName) {
  if (!moduleName.startsWith('.') || !moduleName.endsWith('.js')) return false;
  const originModulePath = context.originModulePath ? path.normalize(context.originModulePath) : '';
  return originModulePath === sharedSrcDir || originModulePath.startsWith(`${sharedSrcDir}${path.sep}`);
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isTransitiveSharedJsImport(context, moduleName)) {
    try {
      return context.resolveRequest(context, moduleName, platform);
    } catch {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
