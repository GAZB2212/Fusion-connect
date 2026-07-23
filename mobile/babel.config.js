module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 moved its worklets Babel plugin to react-native-worklets.
    // Must be listed last.
    plugins: ["react-native-worklets/plugin"],
  };
};
