const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo wiring: Metro must watch the whole workspace so `@rihasham/shared`
// (symlinked from packages/shared) is bundled, and it must look in the root
// node_modules where npm workspaces hoists most dependencies.
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Firebase JS SDK v10 does not declare a "react-native" export condition on its
// umbrella subpaths, so with Metro's package-exports resolution (on by default
// from SDK 53) @firebase/app and @firebase/auth resolve through different
// entry points and end up as two separate module instances. Auth registers
// itself on one, the app asks the other, and startup dies with "Component auth
// has not been registered yet". Falling back to main-field resolution keeps a
// single instance and still selects @firebase/auth's react-native build.
config.resolver.unstable_enablePackageExports = false;

// Hierarchical lookup stays ON: npm nests `@firebase/auth` inside
// node_modules/firebase/node_modules, and only the normal upward walk finds it.
// The cost is that root node_modules holds React 18.3.1 (for the Next.js admin
// app) while this app needs 18.2.0 — so any root-hoisted package importing
// React would pull in a second copy and crash the app with invalid-hook errors.
// Pin the singletons to this app's copy regardless of who imports them.
const SINGLETONS = ['react', 'react-dom', 'react-native'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton = SINGLETONS.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`)
  );
  if (isSingleton) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, 'index.js') },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
