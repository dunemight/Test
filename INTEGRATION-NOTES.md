# WP4 integration notes (delete before deploy)

Branch `wp4-build`, built on WP1 (7990b43). Only WP4 is implemented here.

## New files that must ship next to index.html
- `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.
  The SW install `addAll`s the manifest and all three icons: if any of them is missing on Pages, the install fails and there is no offline copy.
- Icons were rendered from `scratchpad/wf/icon.svg` by `scratchpad/tests-WP4/mkicons.js` (a one-off asset step, not a build step).

## Where WP4 touches index.html
1. `<head>`: one line of manifest, icon and iOS meta tags, and one line of preconnect/dns-prefetch, both right after `<title>`. `theme-color` is untouched (WP2 owns it).
2. CSS: one block `/* offline and install (WP4) */` just before the `prefers-reduced-motion` media query. It includes
   `.menu{max-height:…;overflow-y:auto}` so Settings scrolls on short phones once WP2/WP3/WP7 add rows.
3. Settings HTML: `#offlineBox` (the "Use it offline" heading, the Save-map block `#btnPack`/`#packStatus`/`#packNote`, `#installRow`, `#iosNote`) and `#appVer`, appended at the end of `#menu` after `.menu-acts`.
4. Tiles: the `L.tileLayer` line and its two handlers are replaced by `makeTiles(cors)`, `onTileLoad` and `onTileErr(e)`. The layer can be rebuilt, so always go through the `tiles` variable (the label switch already does).
5. GPX handler: one `try{…navigator.share…}` line before the existing download code.
6. `computeRoute(opts)`: now takes `opts`, and the offline fast path is a self-contained `if(navigator.onLine===false){…return}` block after the "same spot" check and before `var id=++navReq`.
7. `updateNav`: the reroute call is now `computeRoute({reroute:true})`. That's the same signature WP3 specifies; keep WP3's version of the line.
8. `doSearch`: an offline early-return block before the "Searching…" line.
9. One JS section `/* ---------- offline and install (WP4) ---------- */` just before `/* ---------- boot ---------- */`. It runs its own boot actions (SW registration, WeChat banner, `?card=home`), so the boot section itself is unchanged.

## Hooks called through typeof guards (they activate after the merge)
- `say(msg)` (WP2): used when the connection drops, and when map saving starts and ends. The progress label has no aria-live, because it changes on every tile; `say` covers only the start and the end.
- `straightLine()` (WP3): called from the offline fast path in `computeRoute`. **WP3 has not named its straight-line entry point yet.** When merging, replace `if(typeof straightLine==='function')straightLine();` with WP3's real call, or have WP3 expose `straightLine`. D7's "`#navNow` contains 'straight line'" depends on this and is skipped here.
  - Until then, the fast path writes its own `#dirMsg` ("You’re offline… X is 390 m to the south in a straight line (about 6 min)…") and shows the Amap chip. After the merge, shorten that message if WP3's `#navNow` already shows the same distance and direction.
- With WP3's `computeRoute` rewrite, keep the fast path **before** `NAV.inflight=true`/`routeAny`, so nothing is aborted or left in flight. If `opts.reroute&&NAV.route`, it keeps the route and says "Still showing the previous one" (the same wording as WP3's C3), so a reroute while offline never deletes a valid route (B4).
- Pre-WP3, `#navNow` still says "off the route. Finding a new one…" during an offline reroute; WP3's `NAV.inflight` message fixes that.

## Things the merge must wire or check
- **WP2 layer stack:** the deep link runs `history.replaceState(…)` (which drops `?card=home`, so the walk-switch reload doesn't reopen the card) *before* `showCard('home')`. Keep that order when `showCard` starts pushing a history entry, or Back will land on the `?card=home` entry.
- **WP2 `#status`:** WP4 appends `<span id="netTag">` (" · offline") to `#status` from JS; the HTML line is not touched. When WP2 rewrites `setStatus`, it must not clear `#status` children (it only writes `#statusText` today).
- **WP2 44 px targets:** `#btnPack` and `#btnInstall` are `.btn.small`, so they pick up WP2's `min-height:44px` automatically.
- **WP3 `S.tracking` resume / WP3.5 `persist()`:** WP4 also calls `navigator.storage.persist()` when Save is tapped. Both calls are harmless.
- **WP5:** `packUrls` uses `ALL.concat([HOTEL,HOME])`. With WP5, `NEAR` places are not in `ALL`, so the pack covers the walk plus the hotel and not "More nearby" (intended: that list can be large). With `HOME` added, the pack is 674 tiles on Huangxing Rd and 301 on the Hotel loop.
- **WP6 picker:** WP6 always appends a "Search “q” in Amap" row and runs Photon only for ≥3 chars with <3 local hits. In the merged `doSearch`, move the `navigator.onLine===false` check so it skips **only** the Photon request and keeps the local hits, and drop WP4's inline Amap link if WP6's row is already there. The URL format is the same (`uri.amap.com/search?keyword=…&city=430100&center=lng,lat&callnative=1&src=changsha-night-walk`).
- **WP7:** `showCard('home')` becomes taxi mode, so the deep link and the "Hotel taxi card" shortcut keep working unchanged. `#btnCompass`→`#btnHelp` doesn't affect WP4.
- **Banner priority:** the offline banner (`id:'offline'`) only replaces a hidden banner or one with id `tiles`/`gps`/`wechat`; it never covers `perm`/`secure`. If WP3 adds new banner ids (resume, wake-lock), decide whether the offline banner may replace them.
- **Cache version:** bump `SHELL_CACHE` in sw.js (`cnw-shell-v2`) only when the SHELL file list changes. index.html updates don't need a bump, because the shell is stale-while-revalidate and the ETag compare shows "App updated · Reload".
- **Version label:** `VERSION='2026.09.25'` in the WP4 block. Bump it on deploy.

## Deviations from the spec (and why)
- **D3 and the boot banner:** opening the app offline shows " · offline" in the status pill but **no** banner. The offline banner appears on a transition (the `offline` event, or 3+ tile errors in 10 s after earlier loads), which is when the walker needs to know what still works. A banner on every offline open would cover the map for no reason, and D3 asks for "no offline banner" after an offline reload. If nothing is cached for that view, the existing tiles banner explains instead: "You’re offline and this part of the map isn’t saved…".
- **Tile safety net (WP4.5):** instead of rebuilding blindly after ≥6 errors and 0 loads, the page first fetches one failed tile with CORS and then without it. It rebuilds without `crossOrigin` only when CORS alone fails. A dead connection that the phone still reports as online would otherwise have switched off tile caching for the whole session. The check runs at most once every 30 s.
- **Clearing the tile-based offline signal:** a `HEAD` no-cors probe of one tile every 15 s (it bypasses the SW) clears it, because `tileload` can't tell cache hits from network loads. When the connection comes back, the layer is redrawn if any tiles failed (Leaflet never retries them), and a route waiting in the open panel is computed.
- **The first view is cached at once:** on the first `controllerchange`, the tiles already on screen are re-fetched through the SW (at most 80, from the HTTP cache). Without this, the view seen on the very first visit, which loaded before the SW existed, would be blank offline.
- **SW navigation handling:** only `/Test/` and `/Test/index.html` get the app shell; other paths go to the network. Same-origin subresources are read from `cnw-shell-v1` only, not from any cache on the shared origin. Pack requests fetch from their own subdomain with `pack` stripped (the prototype sent them all to webrd01). A pack tile that can't be stored (quota) comes back as 507, so the page counts it as failed rather than saved.
- **Update message:** the message is sent to `clients.get(e.resultingClientId)` as well as `matchAll()`, because the page that is still loading may not be listed by `matchAll()` yet.
- **Save UI:** Before saving, the page checks the pack cache, so a partly saved map resumes ("Save" then fetches only the missing tiles), and after a failure "Retry failed" re-fetches only the failed ones. When everything is saved, the button reads "Saved" and is disabled. The state is per label language: switch Map labels to 中文 and the button offers to save the Chinese map.
- **GPX share:** exactly the spec code (`.catch(function(){})`); a cancelled share doesn't fall back to a download.
- **Registration:** as specified: `https:` or hostname `localhost` only. On file://, content:// and plain http (for example 127.0.0.1), there is no SW, `#offlineBox` is hidden and the version line shows without "saved on this phone".
