// Only the desktop web preview needs this file; the iPhone app runs the same without it.
// On the web SQLite is a .wasm file and needs these two headers to share memory with
// its worker (Expo's SQLite guide, "Web setup").
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
