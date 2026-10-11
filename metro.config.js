// Metro configuration.
// expo-sqlite's web implementation (wa-sqlite) loads SQLite from a .wasm asset and its
// web worker communicates over SharedArrayBuffer, so the dev server must serve
// cross-origin isolation headers. See https://docs.expo.dev/versions/latest/sdk/sqlite/
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
