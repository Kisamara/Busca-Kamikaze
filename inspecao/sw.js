/* Inspeção SST — service worker (offline + atualização automática) */
var VERSION = 'inspecao-v5-2026-10-29a';
var SHELL = ['./', './index.html', './manifest.webmanifest'];
var STATIC = ['./lib/html2canvas.min.js', './lib/jspdf.umd.min.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(SHELL.concat(STATIC).map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('inspecao-') === 0 && k !== VERSION; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function timeout(ms) { return new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); }); }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* Nominatim etc.: nunca em cache */
  var path = url.pathname;
  var isShell = req.mode === 'navigate' || /\/(index\.html|manifest\.webmanifest|)$/.test(path);

  if (isShell) {
    /* network-first: sempre tenta a versão nova; offline cai no cache */
    var key = req.mode === 'navigate' || /\/$/.test(path) ? './index.html' : req;
    e.respondWith(caches.open(VERSION).then(function (cache) {
      return Promise.race([fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }), timeout(3000)]).then(function (res) {
        if (res && res.ok) cache.put(key, res.clone());
        return res;
      }).catch(function () {
        return cache.match(key, { ignoreSearch: true }).then(function (hit) {
          return hit || fetch(req).catch(function () { return new Response('Offline', { status: 503 }); });
        });
      });
    }));
    return;
  }

  /* cache-first para libs/ícones */
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      });
    });
  }).catch(function () { return new Response('Offline', { status: 503 }); }));
});
