# Android quota widget (QA)

A small native companion to the existing web dashboard. It uses the read-only widget API; it cannot change accounts or consume resets. The widget recreates the Scriptable palette, donut, three recovery tiles, weekly panel and update header using a Canvas bitmap inside RemoteViews. A separate native refresh target works without opening the activity.

## User setup

1. Install the [QA APK](https://github.com/9root3/opencodex-mobile/releases/download/android-qa/opencodex-quota.apk); allow installation from that source if Android asks.
2. Open your existing web dashboard in Chrome and log in.
3. Tap **Android 위젯 연결**. Confirm the displayed server address in the app.
4. Accept the launcher's **Add widget** prompt. If unsupported, long-press the home screen and choose Widgets → OpenCodex quota.

No manual server/key entry is needed through the web connection button. Manual entry remains available in the app. Opening the widget body opens the dashboard in your browser; browser login is separate from read-only widget authentication.

## Behavior

- HTTPS only; redirects are rejected so widget keys are not forwarded to another host.
- The key is encrypted using Android Keystore; backup is disabled.
- 30-minute background cache reads through WorkManager; Android battery policies can delay them.
- Refresh triggers `/api/widget/refresh`; the server's one-minute limit still applies.
- Failed requests retain the last snapshot and show `Offline · Cached`.
- One configured server is shared across widget instances. Reconnection clears the old cache.
- No QR pairing yet. The web button passes the widget key directly to the installed app using an explicit Android intent.

## Build and QA

Android 8+ (API 26), JDK 17, Gradle 8.11.1 and Android SDK 35. Run:

```sh
gradle -p android testDebugUnitTest assembleDebug lintDebug
```

The GitHub workflow builds a debug APK. Main-branch CI also builds a QA release APK with a persistent private signing key stored in GitHub Secrets, and publishes it under the `android-qa` prerelease. Future signed QA updates preserve app data. Keep a private backup of the signing key; never commit it. This is QA distribution, not a verified production release.

Check on a real device: Chrome connection, server confirmation, widget pinning, sizing, fresh/cache/offline states, refresh without opening the app, background updates, restart persistence, and opening the dashboard. Do not spend reset credits during QA.
