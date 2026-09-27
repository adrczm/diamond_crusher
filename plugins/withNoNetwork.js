// PRIV-060 / DEV-001: the release manifest must not ask for network (or other unneeded) permissions.
// Library manifests add some of these; `tools:node="remove"` strips them during the manifest merge.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const REMOVED = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_FINGERPRINT',
  'com.google.android.c2dm.permission.RECEIVE',
  'com.google.android.gms.permission.AD_ID',
];

module.exports = function withNoNetwork(config, { keepInternet = false } = {}) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const list = keepInternet
      ? REMOVED.filter((p) => p !== 'android.permission.INTERNET' && p !== 'android.permission.ACCESS_NETWORK_STATE' && p !== 'android.permission.SYSTEM_ALERT_WINDOW')
      : REMOVED;
    const existing = manifest['uses-permission'] || [];
    const kept = existing.filter((p) => !list.includes(p.$['android:name']));
    manifest['uses-permission'] = [
      ...kept,
      ...list.map((name) => ({ $: { 'android:name': name, 'tools:node': 'remove' } })),
    ];
    return cfg;
  });
};
module.exports.REMOVED = REMOVED;
void AndroidConfig;
