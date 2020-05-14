const appName = 'tweet-app-v1'
const appShell = [
    '/',
    '/images/twit.jpg',
    '/images/twit-banner.jpg',
    'js/script.js',
    'css/styles.css',
    'favicon.ico'
]

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(appName).then((cache) => {
            return cache.addAll(appShell);
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((r) => {
        console.log('[Service Worker] Fetching resource: '+e.request.url);
        return r || fetch(e.request).then((response) => {
            return caches.open(appName).then((cache) => {
            console.log('[Service Worker] Caching new resource: '+e.request.url);
            cache.put(e.request, response.clone());
            return response;
            });
        });
        })
    );
});