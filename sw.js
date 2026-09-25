/* Changsha Night Walk service worker. Scope: the folder it is served from (/Test/ on GitHub Pages).
   The github.io origin is shared by every Pages site of the account, so every cache name starts with "cnw-"
   and activate only ever deletes old "cnw-shell-*" caches. */
const SHELL_CACHE = 'cnw-shell-v1';        // bump when the SHELL list changes
const TILE_CACHE  = 'cnw-tiles-v1';        // tiles as they are viewed, FIFO-capped
const PACK_CACHE  = 'cnw-tiles-pack-v1';   // "Save this walk's map" tiles, never trimmed
const TILE_MAX = 2500;                     // ~35 MB at ~14 KB a tile
const SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const TILE_HOST = /^webrd0[1-4]\.is\.autonavi\.com$/;
const BASE = new URL('./', self.location).pathname;   // e.g. /Test/

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(k => k.startsWith('cnw-shell-') && k !== SHELL_CACHE)
    .map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(BASE)) return;
    if (req.mode === 'navigate') {
      if (url.pathname === BASE || url.pathname === BASE + 'index.html') e.respondWith(shell(e));
      return;
    }
    e.respondWith(caches.open(SHELL_CACHE).then(c => c.match(req, { ignoreSearch: true })).then(hit => hit || fetch(req)));
    return;
  }
  if (TILE_HOST.test(url.hostname)) e.respondWith(tile(e, url));
  // everything else (Valhalla, OSRM, Photon, uri.amap.com) goes straight to the network
});

/* App shell: answer from the cache at once (github.io can be slow or unreachable from China), refresh it in the
   background, and tell the page when the refresh brought a new version. */
async function shell(e) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match('./');
  const refresh = fetch('./', { cache: 'no-cache' }).then(async res => {
    if (res.ok && !res.redirected) {
      const tag = r => r && (r.headers.get('etag') || r.headers.get('last-modified'));
      const oldTag = tag(cached), newTag = tag(res);
      await cache.put('./', res.clone());
      if (cached && oldTag && newTag && oldTag !== newTag) await notify(e);
    }
    return res;
  });
  if (cached) { e.waitUntil(refresh.catch(() => {})); return cached; }
  try { return await refresh; }
  catch (err) {
    return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Changsha Night Walk</title>' +
      '<body style="margin:0;padding:40px 24px;background:#0c1426;color:#eef1f7;font:16px/1.5 system-ui,sans-serif">' +
      '<h1 style="font-size:22px">You’re offline</h1><p>Open this page once with a connection so it can be saved on this phone.</p>' +
      '<p><a href="./" style="color:#e8b04a">Try again</a></p></body>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}
/* the page that is loading (resultingClientId) may not be ready yet: clients.get() waits for it */
async function notify(e) {
  const list = await self.clients.matchAll({ type: 'window' });
  if (e.resultingClientId) { const c = await self.clients.get(e.resultingClientId); if (c) list.push(c); }
  const seen = new Set();
  list.forEach(c => { if (!seen.has(c.id)) { seen.add(c.id); c.postMessage({ type: 'app-updated' }); } });
}

/* Tiles: cache-first. The key ignores the webrd0N subdomain and the "pack" flag, so Leaflet and the
   offline pack share one entry per tile. */
function tileKey(url) { const u = new URL(url.href); u.hostname = 'webrd01.is.autonavi.com'; u.searchParams.delete('pack'); return u.href; }
let puts = 0;
async function tile(e, url) {
  const key = tileKey(url), pack = url.searchParams.has('pack');
  const [pc, tc] = await Promise.all([caches.open(PACK_CACHE), caches.open(TILE_CACHE)]);
  let hit = await pc.match(key);
  if (hit) return hit;
  hit = await tc.match(key);
  if (hit) {
    if (pack) await pc.put(key, hit.clone());   // a saved tile must not be lost to the FIFO trim later
    return hit;
  }
  let res;
  if (pack) { const u = new URL(url.href); u.searchParams.delete('pack'); res = await fetch(u.href, { mode: 'cors', credentials: 'omit' }); }
  else res = await fetch(e.request);             // offline: this throws, and Leaflet gets its 'tileerror'
  if (res.ok && res.type === 'cors') {           // never store opaque responses (Chrome pads each to ~7 MB of quota)
    if (pack) {
      try { await pc.put(key, res.clone()); }
      catch (err) { return new Response('', { status: 507, statusText: 'Storage full' }); }   // the page counts it as failed
    } else {
      e.waitUntil(tc.put(key, res.clone()).then(() => { if (++puts % 40 === 0) return trim(tc); }).catch(() => {}));
    }
  }
  return res;
}
async function trim(c) {
  const keys = await c.keys();   // insertion order, so the oldest come first
  for (let i = 0; i < keys.length - TILE_MAX; i++) await c.delete(keys[i]);
}
