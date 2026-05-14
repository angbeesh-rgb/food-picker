const CACHE_NAME = 'mwomogji-v28';
const ASSETS = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // GET 요청, http(s)만 처리. 그 외는 그냥 통과
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 같은 origin의 핵심 파일만 네트워크 우선
  const sameOrigin = url.origin === self.location.origin;
  const isAppFile = sameOrigin && (
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('manifest.json')
  );

  if (isAppFile) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone)).catch(()=>{});
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
  // 그 외 요청(Firebase, 카카오 API 등)은 SW가 가로채지 않고 브라우저 기본 동작에 맡김
});
