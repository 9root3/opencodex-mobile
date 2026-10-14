# Quick Start

[English](QUICKSTART.md) | 한국어 | [README](../README.ko.md)

내 컴퓨터의 OpenCodex를 휴대폰에서 확인합니다. **컴퓨터 준비 → 서버 설치 → 휴대폰 연결 → 홈 화면 설치 → 알림 → 위젯** 순서로 진행하세요. 계정 정보는 본인의 컴퓨터에 보관되며, 모든 사용자가 각자 서버를 설치합니다.

## 1. 내 환경 확인

| 서버 컴퓨터 | 휴대폰 | 현재 가능한 범위 |
|---|---|---|
| Mac | iPhone | 자동 설치, 웹앱, 푸시, Scriptable 위젯. 개발 환경에서 확인했습니다. |
| Mac | Android | Mac 자동 설치 후 같은 웹앱에 연결. 화면과 푸시는 실제 기기 확인이 필요합니다. Android 위젯은 아직 없습니다. |
| Windows | iPhone | Windows 자동 설치·로그인 시 시작·프로세스 복구를 구현했습니다. Windows 실기기 검증은 필요합니다. iPhone은 같은 웹앱·Scriptable을 사용합니다. |
| Windows | Android | Windows 자동 설치 후 같은 웹앱을 사용합니다. Windows·Android 실기기 검증과 Android 위젯은 남아 있습니다. |

이미 Mac 서버가 있다면 휴대폰 종류에 관계없이 **4단계**부터 진행할 수 있습니다. Windows도 아래와 동일한 설치 순서를 사용합니다.

## 2. 컴퓨터 준비

서버 컴퓨터에 다음을 준비하세요.

- [Node.js](https://nodejs.org/) 20 이상과 Git
- [OpenCodex](https://github.com/lidge-jun/opencodex): 실행하고 사용할 계정을 등록해 둡니다.
- [ngrok](https://dashboard.ngrok.com/): 가입 후 본인에게 할당된 고정 HTTPS 주소와 Authtoken을 준비합니다.
- Mac 첫 설치의 토큰 입력에는 `python3`가 필요합니다. Windows는 Windows 10/11 x64의 PowerShell을 사용하며 npm으로 전역 설치한 OpenCodex가 필요합니다. WSL은 이 설치 절차의 대상이 아닙니다.

ngrok 주소는 휴대폰에서 접속하는 웹앱 주소입니다. Authtoken은 Mac의 설치 도구에만 입력하고, 휴대폰 로그인에는 사용하지 않습니다.

## 3. 서버 설치

Mac은 터미널, Windows는 PowerShell을 열어 동일하게 실행하세요.

```sh
git clone https://github.com/9root3/opencodex-mobile.git
cd opencodex-mobile
npm ci
npm run setup -- --url=https://YOUR-ASSIGNED-DOMAIN.ngrok-free.dev
```

`https://YOUR-ASSIGNED-DOMAIN.ngrok-free.dev`를 **본인의 ngrok HTTPS 주소**로 바꾸세요. 요청받으면 Authtoken을 입력합니다. 입력 중 문자가 보이지 않는 것은 정상입니다.

완료 시 `Ready: https://...`가 표시됩니다. 설치 도구가 웹앱과 터널을 로그인 시 자동 실행하도록 등록합니다. Mac은 LaunchAgent, Windows는 작업 스케줄러를 사용합니다. Windows에서는 프로세스가 종료되면 10초 후 복구합니다. OpenCodex 자체는 별도로 실행해야 합니다. 컴퓨터가 켜져 있고 잠들지 않아야 휴대폰에서 접속할 수 있습니다.

## 4. 휴대폰 연결

현재는 **주소와 연결 코드**로 연결합니다. QR 연결은 아직 구현되지 않았습니다.

1. 컴퓨터에서 이 서버의 연결 코드를 확인합니다. Mac 터미널:

   ```sh
   cat "$HOME/Library/Application Support/OpenCodexMobile/.data/pairing-code"
   ```

   Windows PowerShell:

   ```powershell
   Get-Content "$env:LOCALAPPDATA\OpenCodexMobile\.data\pairing-code"
   ```

2. iPhone은 **Safari**, Android는 **Chrome**에서 3단계의 HTTPS 주소를 엽니다.
3. 표시된 코드를 로그인 입력란에 붙여 넣고 **연결하기**를 누릅니다. 현재 화면에는 `서버 연결 코드`라고 표시됩니다.
4. **최신 조회**를 눌러 본인의 계정 풀이 표시되는지 확인합니다.

연결 코드는 서버가 처음 실행될 때 자동 생성됩니다. OpenCodex API 키, ngrok Authtoken, 위젯 키와는 다른 값입니다. 코드나 `.data` 폴더를 공유하거나 GitHub에 올리지 마세요. 서버를 재시작해도 코드와 로그인 세션은 유지됩니다.

## 5. 홈 화면에 설치

| iPhone | Android |
|---|---|
| Safari의 공유 메뉴 → **홈 화면에 추가** → 추가 | Chrome의 ⋮ 메뉴 → **홈 화면에 추가** 또는 **앱 설치** → 안내에 따라 설치 |

설치한 아이콘으로 웹앱을 다시 여세요. 로그인 화면이 나오면 4단계의 연결 코드를 다시 입력합니다. 홈 화면 웹앱에서는 두 휴대폰 모두 같은 사용량 대시보드와 계정 관리 화면을 사용합니다.

공식 안내: [iPhone 홈 화면 설치](https://support.apple.com/guide/iphone/iphea86e5236/ios), [Android 웹앱 설치](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=ko).

## 6. 알림 설정 — 선택 사항

1. 홈 화면 아이콘으로 연 웹앱에서 **이 기기 알림 등록**을 누릅니다.
2. 휴대폰의 알림 권한을 허용합니다.
3. **테스트**를 누르고 실제로 알림이 도착하는지 확인합니다.
4. 원하면 **예약 사용량 알림 켜기**를 선택합니다.

알림 패널은 `이 기기 알림`으로 표시되며 Web Push를 사용합니다. Android에서는 해당 브라우저의 지원과 실제 수신을 확인해야 합니다. iPhone Web Push에는 iOS 16.4 이상과 홈 화면 웹앱이 필요합니다.

예약 시간은 한국 시간 기준입니다. 평일 09:00–10:30 및 20:00–23:30에는 30분마다, 주말 12:00–20:00에는 정각마다 전송합니다. 예약 토글은 이 서버의 공통 설정이며, 등록된 기기들에 전송합니다.

`접수 성공`은 푸시 서비스가 요청을 받았다는 뜻입니다. 실제 수신이 안 되면 알림 권한과 집중 모드를 확인하세요. 홈 화면 앱을 삭제하고 다시 설치했다면 알림을 새로 등록해야 합니다.

## 7. 위젯 설정 — 선택 사항

### iPhone

1. Scriptable을 설치합니다.
2. 웹앱에서 **위젯 코드 복사**와 **위젯 연결 키 표시**를 사용합니다.
3. Scriptable에서 새 스크립트를 만들고 코드를 붙여 넣어 실행합니다.
4. 요청받으면 본인의 웹앱 HTTPS 주소와 **위젯 키**를 입력합니다. 로그인 연결 코드가 아닙니다.
5. 홈 화면에 중간 크기 Scriptable 위젯을 추가하고 해당 스크립트를 선택합니다.

도넛에는 계정 풀의 5시간 잔량, 오른쪽에는 다음 회복 3개와 주간 잔량·회복 2개가 표시됩니다. 자동 갱신 시점은 iOS가 결정하며, 5분 간격을 보장하지 않습니다. 새로고침을 누르면 Scriptable이 열리고 최신 미리보기가 표시됩니다.

### Android

웹앱은 사용할 수 있지만 **이 프로젝트의 Android 홈 화면 위젯은 아직 제공하지 않습니다.** Scriptable 코드를 Android에 설치하는 단계는 없습니다. Android 위젯이 구현되면 같은 풀 잔량과 회복 일정을 제공할 예정입니다.

## 연결이 안 될 때

| 증상 | 먼저 확인할 것 |
|---|---|
| 휴대폰에서 주소가 안 열림 | Mac이 켜져 있는지, 잠자기 상태인지, `npm run service:status`에 웹앱·터널이 실행 중인지 확인 |
| 연결 코드가 틀림 | 현재 연결한 서버의 코드인지 확인. ngrok 토큰·위젯 키를 입력하지 않았는지 확인 |
| OpenCodex 요청 실패 | 같은 Mac에서 OpenCodex가 실행되고 계정이 로그인되어 있는지 확인 |
| 알림 접수 성공인데 수신 안 됨 | 홈 화면 앱에서 다시 등록하고 기기 알림 권한·집중 모드 확인 |
| Windows에서 설치 오류 | Windows 네이티브 Node·OpenCodex 설치와 실행 확인. `npm run service:status` 및 `%LOCALAPPDATA%\OpenCodexMobile\.data` 로그 확인 |

## 앞으로 통일할 연결 경험

다음은 **구현 계획**이며 현재 설치 단계가 아닙니다.

- 설치 도구가 주소·연결 방법을 단계별로 안내합니다.
- 설치 완료 화면에 짧게 유효한 일회용 연결 QR을 표시합니다.
- iPhone·Android에서 스캔하고 연결을 확인한 뒤 로그인합니다.
- 휴대폰에 맞는 홈 화면 설치·알림·위젯 안내를 표시합니다.

현재 안내는 지원 범위를 숨기지 않고 동일한 순서로 구성한 Quick Start입니다. 네 조합의 동일한 위젯 경험을 완성하려면 QR 연결, Android 위젯과 Windows를 포함한 각 기기 검증이 추가로 필요합니다.
