import type { ExpoConfig } from 'expo/config';

// No personal data belongs in this file (DATA-002).
// DC_DEV=1 keeps network permissions so a development build can talk to Metro; release builds never set it.
const isDevBuild = process.env.DC_DEV === '1';
const versionCode = Number(process.env.DC_VERSION_CODE ?? '1');
// Web build (Safari on a Mac): the path the site is served under, e.g. /diamond_crusher for GitHub Pages.
const webBase = process.env.DC_WEB_BASE ?? '';

const config: ExpoConfig = {
  name: 'Diamond Crusher',
  slug: 'diamond-crusher',
  scheme: 'diamondcrusher',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  newArchEnabled: true,
  splash: { backgroundColor: '#0f1720', image: './assets/splash.png', resizeMode: 'contain' },
  android: {
    package: 'app.diamondcrusher.trainer',
    versionCode,
    allowBackup: false,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0f1720' },
    permissions: ['android.permission.VIBRATE', 'android.permission.USE_BIOMETRIC', 'android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED'],
  },
  ios: {
    bundleIdentifier: 'app.diamondcrusher.trainer',
    supportsTablet: false,
    infoPlist: {
      NSFaceIDUsageDescription: 'Unlock the app with Face ID.',
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/icon.png',
    name: 'Diamond Crusher',
    shortName: 'Diamond Crusher',
    themeColor: '#1A1A1A',
    backgroundColor: '#F1F1F1',
  },
  plugins: [
    'expo-router',
    ['expo-sqlite', { useSQLCipher: true }],
    ['expo-secure-store', { faceIDPermission: 'Unlock the app with Face ID.', configureAndroidBackup: false }],
    ['expo-local-authentication', { faceIDPermission: 'Unlock the app with Face ID.' }],
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#303030' }],
    ['expo-audio', { recordAudioAndroid: false }],
    ['expo-build-properties', { android: { enableProguardInReleaseBuilds: false } }],
    ['./plugins/withNoNetwork', { keepInternet: isDevBuild }],
    './plugins/withBackupRules',
    './plugins/withSecureWindow',
    './plugins/withReleaseSigning',
  ],
  experiments: { typedRoutes: false, ...(webBase ? { baseUrl: webBase } : {}) },
  extra: { router: {} },
};

export default config;
