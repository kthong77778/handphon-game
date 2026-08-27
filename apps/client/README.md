# @handphon/client

게임 화면. 빌드 산출물을 **웹 정적 호스팅과 Capacitor 번들 양쪽에** 그대로 쓴다.

## 상태

미착수. **UI 프레임워크 미정** — 이 결정이 있어야 시작할 수 있다.

React 계열이면 방치형 특성상 주의가 필요하다. `money` 가 rAF 마다(초당 60회) 바뀌므로
React 는 memo/ref 와 씨름하게 되고, Svelte·Solid 의 세밀한 반응성이 더 자연스럽다.

## 어댑터

시뮬레이션 코어는 그대로 두고 **상태의 주인만 바꾼다.** 지인 테스트본과 최종본의 유일한 차이.

```
adapter/local    지인 테스트용 — simulate 결과를 localStorage 에 저장. 서버 없음
adapter/remote   최종본       — 로컬에서 예측 후, 서버 응답으로 보정
```

## 폴더

```
src/
  adapter/   local | remote — 상태를 어디에 두는가
  ui/        HUD·목록·모달 (선언형)
  scene/     거리 연출·황금손님·도둑 (명령형 유지. 프레임워크로 옮기면 오히려 늘어난다)
```

## 옛 코드에서 가져올 것

- 애니메이션은 `element.animate()` (WAAPI) 로. 구 코드의 `getBoundingClientRect()` 강제 리플로우 핵이 불필요해진다
- `Fmt` 의 한국식 단위(만·억·조…극)는 라이브러리로 대체 불가. `git show main:assets/js/format.js`
- `confirm()` / `prompt()` 는 쓰지 않는다 (웹뷰에서 완성도를 크게 깎는다)
