'use strict';
const CACHE = 'codex-hearts-v2';
const FILES = ['./','./index.html','./style.css','./screens.css','./game.css','./deck.js','./engine.js','./i18n.js','./app.js','./manifest.json','./icons/icon.svg','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate',event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('codex-hearts-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch',event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request,{ignoreSearch:true});
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch { if (event.request.mode === 'navigate') return await cache.match('./index.html'); return new Response('Offline',{status:503}); }
  }));
});
