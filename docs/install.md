# Installing Diamond Crusher on an Android phone

The app is installed straight onto the phone from an APK file. It isn't in the Play Store, and it needs no account.
It works on any Android phone running Android 7.0 or newer.

## 1. Get the APK

**Easiest (after the pull request is merged):** on the phone, open the repository's **Releases** page on GitHub and
download the newest `diamond-crusher-…apk` file.

**Before merging, or for any branch:**

1. Open the repository on GitHub and go to **Actions** → **Android APK**.
2. Open the newest run with a green tick.
3. Under **Artifacts**, download the `diamond-crusher-…apk` entry. GitHub delivers it as a `.zip` file.
4. Unzip it. The `.apk` file inside is the app.

You need to be signed in to GitHub to download Actions artifacts. They are kept for 30 days.

## 2. Install it

1. Open the `.apk` file on the phone (from Downloads, or from the Files app).
2. Android asks for permission to install apps from that source (your browser or the Files app). Tap **Settings**,
   turn on **Allow from this source**, then go back.
3. Tap **Install**. If Play Protect warns that it doesn't recognise the app, tap **More details** → **Install anyway**.
   This happens because the app isn't from the Play Store.
4. Open **Diamond Crusher**.

From a computer instead: with USB debugging on, run `adb install diamond-crusher-….apk`.

## 3. Updating to a newer build

1. In the app, go to **Settings** → **Your data** → **Save a backup file**, and keep the file and its passphrase safe.
2. Install the new APK over the old one, the same way as above. Your data stays in place.

If Android says the app "conflicts with an existing package", the new build was signed with a different key (see below).
Restore from your backup file: uninstall the old app, install the new one, and choose **Import a backup** on the first screen.

## Signing key

Every build must be signed with the same key for updates to install over each other.

- Without any setup, builds are signed with the Expo/React Native template key. It is the same for every build, so updates
  install fine, but it is a public key: anyone could build an app that Android treats as an update of this one. That is
  acceptable for personal testing, not beyond.
- For your own private key, create one once and add it to the repository as secrets. After that, every build uses it.

```bash
keytool -genkeypair -v -keystore release.keystore -alias diamondcrusher -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 release.keystore > release.keystore.b64
```

In GitHub, go to **Settings** → **Secrets and variables** → **Actions** and add:

| Secret | Value |
|---|---|
| `DC_KEYSTORE_BASE64` | contents of `release.keystore.b64` |
| `DC_KEYSTORE_PASSWORD` | the keystore password |
| `DC_KEY_ALIAS` | `diamondcrusher` (or the alias you chose) |
| `DC_KEY_PASSWORD` | the key password |

Keep `release.keystore` and its passwords somewhere safe outside the repository. Switching from the template key to your own
key means one reinstall (backup file → uninstall → install → import).

## Building locally

Needs Node 22, Java 17 and the Android SDK.

```bash
npm ci
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

For development with live reload, build with `DC_DEV=1` so the app keeps the network permission it needs to reach Metro:
`DC_DEV=1 npx expo run:android`. Release builds never have internet access.
