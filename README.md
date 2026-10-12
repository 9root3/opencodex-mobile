# OpenCodex Mobile

A personal mobile dashboard and Scriptable widget companion for [OpenCodex](https://github.com/lidge-jun/opencodex).

![App icon](public/icon-192.png)

The sage-green clock icon uses the same graduated green palette as the quota widget.

An independent community companion, not an official OpenCodex or OpenAI app. Each installation connects to its owner's local OpenCodex instance. No hosted central service is included.

## Features

- Account pool usage, reset times, account selection, pause/resume, priority and rotation controls.
- Per-account banked reset inspection and explicitly confirmed consumption, relayed through OpenCodex with a UUID operation identity.
- iPhone Home Screen web app with Web Push notifications.
- Scriptable widget: five-hour aggregate remaining quota, three upcoming recoveries, weekly quota and two upcoming weekly recoveries.
- Five-minute widget reload requests; actual timing is controlled by iOS.
- Final widget layout: quota donut, three colored five-hour recovery tiles, a gray weekly panel with two recovery rows, and compact update/refresh header.
- Manual widget refresh opens Scriptable and presents an updated preview.
- No LLM calls for report formatting or scheduling.

Quota aggregates weight each account equally. They approximate percentages, not absolute token capacity; subscription plans can have different limits. Cached data is labelled and expired reset information requires a fresh observation.

## Requirements

- Node.js 20+ and an installed, running OpenCodex instance on the same Mac.
- Existing OpenCodex accounts; this companion does not register provider accounts.
- A stable HTTPS URL pointing to the app for mobile access and Web Push.
- Scriptable on iPhone for the optional widget.

## Run

```sh
npm ci
export PUBLIC_HTTPS=1
export VAPID_SUBJECT=https://your-public-app-host
npm start
```

The default listener is `127.0.0.1:10300`. Publish only this companion through your chosen tunnel, not the original OpenCodex administrative listener. Preserve the public Host header at the proxy.

Read `.data/pairing-code` locally to sign in. Server restarts preserve the pairing code and hashed login sessions. Server-side sessions have no expiry until logout/revocation; browser cookies are renewed for 400 days on authenticated access. Browser data deletion can still require login. The app stores VAPID credentials, subscriptions and its widget key inside `.data`; never share or commit that directory.

Configuration options: `PORT`, `HOST`, `PUBLIC_HTTPS`, `VAPID_SUBJECT`, `OPENCODEX_CLI`. `.env.example` documents variables; `.env` is not loaded automatically. OpenCodex configuration currently uses `~/.opencodex`, and quota refresh uses its authenticated loopback API.

## iPhone setup

1. Open the HTTPS URL in Safari and sign in with the Mac pairing code.
2. Share → Add to Home Screen.
3. Open the installed web app, register notifications, then test delivery.
4. Enable scheduled reports if wanted.

Schedules use Asia/Seoul: weekdays 09:00–10:30 and 20:00–23:30 every 30 minutes; weekends 12:00–20:00 hourly. Notifications default OFF. The Mac and server must stay awake/running.

## Scriptable widget

Copy the widget code using the dashboard button, paste into a new Scriptable script, and run it once. Enter the HTTPS URL and widget key shown after dashboard login. Add a medium Scriptable widget and select that script.

The widget key permits cache reads and a rate-limited quota refresh, not account management. Credentials are stored using Scriptable Keychain. Public script source contains no user credentials. Changes to hosted code require copying it into Scriptable again.

## ngrok helper

Install the ngrok binary into `.tools/ngrok`, then run `python3 scripts/connect-ngrok.py` locally. Token input is hidden; configuration stays in `.data/ngrok.yml`. The ngrok tool is not bundled with this repository. Use its account-assigned development domain and monitor your plan's limits.

## Banked resets

On each account card, select **Reset 조회** to inspect the available count, then **Reset 1개 사용** and confirm to spend one. This uses OpenCodex’s authenticated reset-credit API; account tokens stay on the Mac. No automatic consumption is performed.

An operation UUID is retained in browser session storage when the outcome is uncertain. Use the same pending request to check its result; do not create a new request from another browser after a timeout. OpenCodex owns the durable redemption ledger. Widget credentials cannot inspect or consume resets.

Actual reset consumption is not exercised by automated or live development tests.

## Validation and limits

```sh
npm test
node --check server.mjs
node --check public/app.js
node --input-type=module --check < scriptable/OpenCodex.js
```

Tests use injected fake account operations and temporary configuration; they do not change live accounts. Real HTTPS quota refresh and iPhone Web Push were tested during development. Every device and Scriptable layout still needs its own verification.

The deployed Mac installation uses user LaunchAgents for web and tunnel auto-start/recovery. Runtime lives in `~/Library/Application Support/OpenCodexMobile`; source changes must be copied into that runtime before restart. No central hosting, native iOS app or native APNs delivery is included. Management commands still use the installed OpenCodex CLI and depend on its runtime compatibility.

## Licensing

OpenCodex itself is MIT licensed and installed separately. This repository's own source license has not yet been selected; public visibility does not grant a general reuse license. Check third-party dependency licenses before redistributing a bundled server. In particular `web-push` is MPL-2.0; other dependencies include MIT, ISC, BSD-3-Clause and Apache-2.0 licenses.

## Persistent login

Only hashes of session tokens are saved in `.data/sessions.json` with restricted permissions. The app provides logout to revoke the current token. There is no seven-day server expiry; cookie persistence remains subject to browser policy.
