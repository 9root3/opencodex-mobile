# Quick Start

English | [한국어](QUICKSTART.ko.md) | [README](../README.md)

Use the same sequence for every device: **prepare your computer → install the server → connect your phone → install the web app → enable notifications → add a widget**. Each user runs their own server; there is no shared hosted service.

## 1. Choose your devices

| Computer | Phone | Current support |
|---|---|---|
| Mac | iPhone | Automated installation, web app, Web Push and Scriptable widget; checked in the development environment. |
| Mac | Android | Connect to the same web app after Mac setup; device layout and push delivery need real-device verification. No Android widget yet. |
| Windows | iPhone | Windows installation, login startup and process recovery are implemented; real-device verification remains pending. iPhone uses the same web app and Scriptable widget. |
| Windows | Android | Windows setup connects to the same web app; Windows/Android device verification and the Android widget remain pending. |

If you already have a Mac server, start at step 4 on either phone. Windows users follow the same installation sequence below.

## 2. Prepare your computer

Install [Node.js](https://nodejs.org/) 20+ and Git. Start [OpenCodex](https://github.com/lidge-jun/opencodex) and register your accounts. Create an [ngrok account](https://dashboard.ngrok.com/) and obtain your assigned stable HTTPS URL and Authtoken. Initial hidden token entry on Mac also requires `python3`. Windows requires Windows 10/11 x64, PowerShell and npm-installed global OpenCodex; WSL is not covered.

The HTTPS URL is your phone's web app address. Enter the ngrok Authtoken only in the Mac installer, not in the phone login form.

## 3. Install the server

Run in an interactive Mac terminal or Windows PowerShell:

```sh
git clone https://github.com/9root3/opencodex-mobile.git
cd opencodex-mobile
npm ci
npm run setup -- --url=https://YOUR-ASSIGNED-DOMAIN.ngrok-free.dev
```

Replace the example URL with your assigned ngrok HTTPS URL. Enter your Authtoken when prompted; hidden input is normal. Wait for `Ready: https://...`. Setup registers the web app and tunnel to start at login using macOS LaunchAgents or Windows Task Scheduler. The Windows supervisor restarts exited processes after 10 seconds. OpenCodex itself must run separately. Keep the computer awake and running for phone access.

## 4. Connect your phone

Connection currently uses a URL and code. **QR pairing is not implemented.**

1. On the Mac, display the automatically generated connection code:

   ```sh
   cat "$HOME/Library/Application Support/OpenCodexMobile/.data/pairing-code"
   ```

   On Windows PowerShell:

   ```powershell
   Get-Content "$env:LOCALAPPDATA\OpenCodexMobile\.data\pairing-code"
   ```

2. Open your HTTPS URL in **Safari on iPhone** or **Chrome on Android**.
3. Paste the code into the login field and select **연결하기** (Connect). The current field label is `서버 연결 코드`.
4. Select **최신 조회** (Refresh) and confirm your account pool appears.

The code is generated on first server startup and survives restarts. It is different from your OpenCodex API key, ngrok Authtoken and widget key. Never share the code or publish `.data`. Server restarts also preserve login sessions.

## 5. Install on the home screen

- **iPhone:** Safari Share → Add to Home Screen → Add.
- **Android:** Chrome ⋮ → Add to Home screen or Install app → follow the prompt.

Reopen the app using its home-screen icon. If asked, log in again with the same connection code. Both phones use the same dashboard and account-management interface.

Official instructions: [iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios), [Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en).

## 6. Enable notifications — optional

In the installed web app, select **이 기기 알림 등록** (Register this device), allow notifications and select **테스트** (Test). Verify actual receipt before enabling **예약 사용량 알림 켜기** (Scheduled reports).

The panel title is `이 기기 알림` (This device notifications); registration uses Web Push. Android browser support and delivery require device verification. iPhone Web Push requires iOS 16.4+ and a home-screen web app.

The server-wide toggle sends reports to registered devices on the Asia/Seoul schedule: weekdays 09:00–10:30 and 20:00–23:30 every 30 minutes; weekends 12:00–20:00 hourly. Accepted requests do not guarantee visible notifications. Check permission and Focus settings. Register again after deleting and reinstalling the home-screen app.

## 7. Add a widget — optional

### iPhone

1. Install Scriptable.
2. In the web app, select **위젯 코드 복사** (Copy widget code) and **위젯 연결 키 표시** (Show widget key).
3. Create a Scriptable script, paste the code and run it.
4. Enter your web app HTTPS URL and **widget key**, not the login connection code.
5. Add a medium Scriptable home-screen widget and choose the script.

The widget shows pool-wide five-hour remaining quota, three upcoming recoveries, weekly remaining quota and two weekly recoveries. iOS controls automatic updates; five-minute refresh timing is not guaranteed. Manual refresh opens Scriptable and displays an updated preview.

### Android

The web app is available, but **this project does not provide an Android home-screen widget yet**. Do not attempt to install Scriptable code on Android. The planned Android widget will show the same pool totals and recovery schedule.

## Troubleshooting

| Problem | First check |
|---|---|
| URL does not open | Keep the Mac awake; run `npm run service:status` to inspect web and tunnel services. |
| Invalid connection code | Use the code belonging to this server, not an ngrok token or widget key. |
| OpenCodex request failed | Confirm OpenCodex is running on the same Mac and its accounts are signed in. |
| Push accepted but not received | Register in the home-screen app and check notification permission and Focus settings. |
| Installer fails on Windows | Check native Windows Node/OpenCodex installation, `service:status` and runtime `.data` logs. |

## Planned unified connection experience

This is a roadmap, **not a working installation flow**: equivalent Mac/Windows installers, a short-lived single-use pairing QR at installation completion, confirmation on either phone, and device-specific home-screen, notification and widget guidance.

This guide uses the same step sequence while stating actual support. Identical experiences across all four combinations still require QR pairing, an Android widget and device verification including Windows.
