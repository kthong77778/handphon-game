# 분식집 키우기 — 작업 지침

방치형(idle) 모바일 웹게임. **빌드 과정이 없는 정적 사이트**라 `index.html` 을 열면 그대로 돈다.
`main` 에 들어가면 GitHub Pages 가 그대로 배포한다. 번들러·프레임워크·타입스크립트를 쓰지 않는다.

## 코드 지도

| 파일 | 맡는 것 |
|---|---|
| `assets/js/format.js` | 숫자·시간 표기 (만·억·조·경·해) |
| `assets/js/data.js` | 밸런스 수치 전부 + 스킨 데이터 + 손그림 SVG(`face` `SNACKS` `ONIGIRI`) |
| `assets/js/state.js` | 세이브 저장·불러오기·검증 |
| `assets/js/game.js` | 수익 계산(캐시), 버프, 콤보, 매크로 방지, 환생, 명예의 전당 |
| `assets/js/scene.js` | 가게 앞 거리 연출 (수치에는 일절 관여하지 않는다) |
| `assets/js/ui.js` | DOM 렌더링, 입력, 황금 손님·도둑 등장 |
| `assets/js/main.js` | 부팅, 게임 루프, 자동 저장 |
| `assets/css/style.css` | 모바일 우선 다크 테마 |

## 테스트

```bash
node tests/logic.js         # 게임 로직 133항목 (의존성 없음)
node tests/macro-stress.js  # 매크로 오탐률 — 사람 오탐 0% 가 합격선
node tests/progression.js   # 진행 속도 — 밸런스를 건드렸으면 반드시 확인
node tests/browser.js       # 실제 브라우저 124항목 (npm i -D playwright 필요)
node tests/browser.js 도둑   # 이름으로 스위트 하나만
```

브라우저 테스트는 정적 서버를 내장하고 있어 따로 띄우지 않아도 된다.
크로미움 경로를 직접 줘야 하면 `CHROMIUM_PATH` 를 쓴다.

## 반드시 지킬 것

이미 한 번씩 사고가 났던 것들이다.

1. **`Game.invalidate()`** — 수익 계산은 캐시된다. 세이브(`State.get()`)의 `gens` ·
   `upgrades` · `fameLv` · `fame` · `achievements` 를 건드렸다면 반드시 함께 부른다.
   안 부르면 옛 배율이 그대로 남는다.

2. **`[hidden]` 을 이기는 규칙을 만들지 말 것** — 클래스에 `display` 를 지정하면
   브라우저 기본값 `[hidden]{display:none}` 을 덮어써서 숨김이 동작하지 않는다.
   `style.css` 맨 위의 `[hidden]{display:none !important}` 가 이를 막고 있으니 지우지 말 것.

3. **트랜지션 전에 레이아웃을 강제로 읽을 것** — 시작 `transform` 을 넣고 곧바로 도착
   `transform` 을 넣으면 브라우저가 한 프레임으로 합쳐 트랜지션이 아예 시작되지 않는다.
   사이에 `node.getBoundingClientRect()` 를 넣는다. `ui.js` 의 `glideTo`,
   `scene.js` 의 `glide` 가 그렇게 되어 있다.

4. **단계 판정은 버프를 뺀 값으로** — 조리 메뉴 단계는 `Game.tapBaseValue()` 를 쓴다.
   `tapValue()` 를 쓰면 손님 몰이를 켤 때마다 메뉴가 올라갔다 내려간다.

5. **오프라인 보상은 `perSec(true)`** — 버프를 켠 채 나갔다고 보상이 부풀면 안 된다.

6. **전신으로 그려지는 이모지만** — 거리를 걷는 손님에 🧑 같은 상반신 이모지를 쓰면
   머리만 떠다니는 것처럼 보인다. 이모지 글리프는 CSS 박스보다 아래로 삐져나오므로
   바닥에 붙이면 잘린다 (`scene.js` 에서 20px 남짓 띄운다).

7. **세이브 호환** — `state.js` 의 `normalize()` 는 없는 필드를 기본값으로 채우고 깨진
   값을 걸러낸다. 필드를 추가하면 `numKeys` 에 넣고, 배열·문자열은 따로 검증한다.
   구버전 세이브로도 게임이 도는지 `tests/logic.js` 가 확인한다.

8. **테스트에 개수를 하드코딩하지 말 것** — 명성상점·도전과제·스킨 개수는 `Data` 에서
   읽는다. 항목을 늘릴 때마다 테스트가 깨지면 안 된다.

## 눈으로 확인할 것

그림·연출·레이아웃을 건드렸다면 **반드시 렌더해서 본다.** 지금까지 나온 문제 중
어묵이 나비넥타이가 된 것, 냄비 거품이 허공에 뜬 것, 얼굴이 쟁반 밖에 있던 것,
손님이 바닥에서 잘린 것은 전부 코드로는 멀쩡했고 그려봐야 보였다.

## 커밋

한국어로 쓴다. 무엇을 왜 바꿨는지, 특히 **어떤 판단을 했고 무엇을 시도했다 접었는지**를
남긴다. 모델 이름이나 도구 이름은 커밋 메시지에 넣지 않는다.
