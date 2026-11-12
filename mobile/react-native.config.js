// CallKit's WebRTC dependency is iOS-only for this app; keep it out of the
// Android build (see app.config.js for the CallKit build switch).
module.exports = {
  dependencies: {
    "@livekit/react-native-webrtc": { platforms: { android: null } },
  },
};
