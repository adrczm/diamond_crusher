// ARCH-062: sign release builds with the owner's keystore when its details are provided at build time
// (environment variables or an untracked gradle.properties). Without them the build falls back to the
// template debug key so a test APK can still be produced; see docs/install.md.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (System.getenv("DC_KEYSTORE_FILE")) {
                storeFile file(System.getenv("DC_KEYSTORE_FILE"))
                storePassword System.getenv("DC_KEYSTORE_PASSWORD")
                keyAlias System.getenv("DC_KEY_ALIAS")
                keyPassword System.getenv("DC_KEY_PASSWORD")
            } else if (project.hasProperty("DC_KEYSTORE_FILE")) {
                storeFile file(project.property("DC_KEYSTORE_FILE"))
                storePassword project.property("DC_KEYSTORE_PASSWORD")
                keyAlias project.property("DC_KEY_ALIAS")
                keyPassword project.property("DC_KEY_PASSWORD")
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('DC_KEYSTORE_FILE')) {
      src = src.replace(/signingConfigs\s*\{/, (m) => m + RELEASE_CONFIG);
      // Point the release build type at the release signing config.
      src = src.replace(/(release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
