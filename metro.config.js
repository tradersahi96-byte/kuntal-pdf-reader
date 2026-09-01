const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable inline asset resolution and support Base64/PDF rendering
config.resolver.assetExts.push('pdf', 'png', 'jpg', 'jpeg');

module.exports = config;
