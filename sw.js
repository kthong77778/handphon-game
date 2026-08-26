/* 오프라인에서도 실행되도록 앱 셸을 캐시한다 */
var CACHE = 'bunsik-idle-v13';

var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/js/format.js',
  './assets/js/sound.js',
  './assets/js/data.js',
  './assets/js/state.js',
  './assets/js/game.js',
  './assets/js/scene.js',
  './assets/js/ui.js',
  './assets/js/main.js',
  './assets/icon.svg',
  './assets/icon-maskable.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        // 같은 출처의 응답만 캐시에 추가
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
