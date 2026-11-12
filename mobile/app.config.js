// Dynamic Expo config layered over app.json.
//
// Native CallKit (full-screen ringing when the app is closed) is a build-time
// switch driven purely by whether its two packages are installed:
//
//   ON  (default): expo-callkit-telecom + @livekit/react-native-webrtc present
//       -> the config plugin and the `voip` background mode are added.
//   OFF: npm uninstall expo-callkit-telecom @livekit/react-native-webrtc
//       -> neither is added; the app rings in-app and via push notification.
//
// Apple rejects apps that declare the `voip` background mode without using
// CallKit, so the mode must only ever ship together with the module. The JS
// (src/callkit.ts) detects the native module at runtime and needs no changes.
const fs = require("fs");
const path = require("path");

const hasPackage = (name) =>
  fs.existsSync(path.join(__dirname, "node_modules", name, "package.json"));

const pluginName = (p) => (Array.isArray(p) ? p[0] : p);

module.exports = ({ config }) => {
  const callKit =
    hasPackage("expo-callkit-telecom") && hasPackage("@livekit/react-native-webrtc");

  const plugins = (config.plugins || []).filter(
    (p) => pluginName(p) !== "expo-callkit-telecom"
  );
  const backgroundModes = new Set(config.ios?.infoPlist?.UIBackgroundModes || []);
  backgroundModes.delete("voip");

  if (callKit) {
    plugins.push([
      "expo-callkit-telecom",
      {
        microphonePermission: "Fusion needs the microphone for voice and video calls.",
        cameraPermission: "Fusion needs camera access for face verification and video calls.",
        incomingCallTimeout: 45,
        defaultRingtoneIos: "default",
      },
    ]);
    backgroundModes.add("voip");
  }

  return {
    ...config,
    plugins,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        UIBackgroundModes: [...backgroundModes],
      },
    },
  };
};
