// PRIV-020: exclude all app data from Android cloud backup and device-to-device transfer.
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DATA_EXTRACTION = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
  </cloud-backup>
  <device-transfer>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
  </device-transfer>
</data-extraction-rules>
`;

const FULL_BACKUP = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="root" path="." />
  <exclude domain="file" path="." />
  <exclude domain="database" path="." />
  <exclude domain="sharedpref" path="." />
  <exclude domain="external" path="." />
</full-backup-content>
`;

module.exports = function withBackupRules(config) {
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    app.$['android:allowBackup'] = 'false';
    app.$['android:fullBackupContent'] = '@xml/dc_full_backup_rules';
    app.$['android:dataExtractionRules'] = '@xml/dc_data_extraction_rules';
    const replace = new Set((app.$['tools:replace'] || '').split(',').filter(Boolean));
    ['android:allowBackup', 'android:fullBackupContent', 'android:dataExtractionRules'].forEach((a) => replace.add(a));
    app.$['tools:replace'] = [...replace].join(',');
    return cfg;
  });
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'dc_data_extraction_rules.xml'), DATA_EXTRACTION);
      fs.writeFileSync(path.join(dir, 'dc_full_backup_rules.xml'), FULL_BACKUP);
      return cfg;
    },
  ]);
};
