// PRIV-015: FLAG_SECURE on the main window (blocks screenshots, screen casting and the recents thumbnail).
const { withMainActivity } = require('expo/config-plugins');

module.exports = function withSecureWindow(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withSecureWindow expects a Kotlin MainActivity');
    }
    if (!src.includes('import android.view.WindowManager')) {
      src = src.replace('import android.os.Bundle', 'import android.os.Bundle\nimport android.view.WindowManager');
    }
    if (!src.includes('FLAG_SECURE')) {
      src = src.replace(
        /super\.onCreate\(null\)/,
        'super.onCreate(null)\n    window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)'
      );
    }
    if (!src.includes('FLAG_SECURE')) {
      throw new Error('withSecureWindow could not patch MainActivity.onCreate');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
