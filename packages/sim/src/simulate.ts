// 진입점: simulate(state, action, now, rng) -> newState
//
// 비타협 규칙
//   1. 순수 함수. 모듈 전역 상태 금지 (구 game.js 는 combo/캐시/매크로가 전역이라 서버 불가)
//   2. Date.now() / Math.random() 을 이 안에서 부르지 않는다. 인자로 받는다
//   3. 클라는 예측용, 서버는 권위용으로 같은 코드를 돌린다
export {};
