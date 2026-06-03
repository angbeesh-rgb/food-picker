const CACHE_NAME = 'mwomogji-v55';
const OFFLINE_URL = './offline.html';
const ASSETS = [
  './index.html',
  './manifest.json',
  './offline.html',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './icon-apple.png'
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
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

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
        .catch(async () => {
          // 1순위: 캐시
          const cached = await caches.match(e.request);
          if (cached) return cached;
          // 2순위: HTML 요청이면 오프라인 페이지
          const isHTML = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');
          if (isHTML) {
            const offline = await caches.match(OFFLINE_URL);
            if (offline) return offline;
          }
          // 3순위: 빈 응답
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
    );
  }
});
