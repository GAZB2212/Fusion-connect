const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// This app lives in a subfolder of a larger repo whose root node_modules
// contains the web app's React 18. Pin all module resolution to this app's
// own node_modules so Metro never picks up the parent's React (which would
// otherwise cause a duplicate-React crash).
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
