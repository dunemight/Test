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

# WP3 integration notes (delete before deploy)

Branch `wp3-build`, built on the WP1 commit 7990b43. Only WP1 is present here. Everything below is what the merge
with WP2, WP4 and WP5-WP7 has to wire, keep or delete. Tests: `scratchpad/tests-WP3/` (`wp3.js`, `wp1.js`, `r0.js`).

## Hooks called through guards (light up after the merge)
- `say()` (WP2) is called as `if(typeof say==='function')say(...)` in `updateNav` (step change, first off-route tick),
  and in `navArrived` (only when no arrival toast was shown).
- Arrival announcements rely on WP2's `toast()` calling `say(msg)`. `arrive()` therefore does NOT call `say` itself
  (the spec lists both; doing both would read "Arrived at X" twice). If the merged `toast` stops calling `say`, add
  `if(typeof say==='function')say('Arrived at '+...)` to `arrive()`.
- `openLayer` / the WP2 history stack: WP3 adds no new overlay, so nothing to wrap.

## Merge conflicts to expect, and which side to take
- `updateNav`: WP2 added `say` calls inside the old `updateNav`. Take WP3's version (it already contains the equivalent
  guarded `say` calls) and drop WP2's duplicates. WP2's `NAV.saidArr` is replaced by `NAV.arrived`.
- `setStatus`: WP3 did not change it. The watchdog calls `setStatus('search','Last fix N s ago')` every second; WP2's
  version only rewrites text on change and only announces tier changes, so that is fine.
- `#compass` markup: now `<button class="compass idle" id="compass" type="button" aria-pressed aria-label="Use the phone compass">`
  with `<span class="ring" id="compassRing"><span class="n" id="northMark">N</span></span>` and the arrow svg
  (`aria-hidden`). If WP2 touched the old `div#compass` (aria-hidden, lang), keep WP3's element. WP2's 44 px target
  rules don't need to apply (the dial is 70 px).
- `showBanner`: untouched. The resume banner inserts its own `button.act` ("Resume") before the first button in
  `#banner`. WP2 turns Dismiss into a 44x44 "×"; check that `.banner button.act` (gold pill) still wins over WP2's
  `.banner button` rule, or give it higher specificity.
- `syncSettings`: WP3 adds `$('#optVoice').checked=S.voice;` next to WP2's theme lines.
- `#btnCompass`: kept. WP7 turns it into `#btnHelp`; then delete `$('#btnCompass').addEventListener('click',toggleCompass)`
  and `'#btnCompass'` from `setCompassPressed`. The dial (`#compass`) already toggles the compass (G4).
- CSS: WP3's rules are one block after `.pickbar span{flex:1}` ("WP3: compass dial …"). WP2's fill tokens should also
  cover `.nav-now.off` (already listed) and the new `.nav-now .chip` (white on blue, fine) and `.chip.primary`
  (gold fill with `--gold-ink`: same pair as `.btn.primary`). Consider `path.crow` in WP2's dark/routing styles: while
  routing, WP2 dims `path.route` (the dotted order line), which is what keeps the gold dashed straight line distinct
  from it.

## Banner-aware framing (QA round 1 fix)
- `topOcc()` is the top edge of the clear map: `56+SAT`, or `#banner`'s bottom + 12 while a banner shows. It is
  measured, so WP2's taller banner (44x44 "×") and WP4's offline/WeChat banners are covered without changes. It assumes
  `#banner` stays docked at the top of the screen; if the merge moves it, revisit `topOcc()`.
- `centerAbove`, `frameNext` (top padding `max(70+SAT, topOcc()+12)`), `fitView` (route fits) and the `followPan` dead
  zone use it. With no banner showing they behave exactly as before (spec values).
- `frameNext` falls back to `setView(centerAbove(me,17),17)` when less than 40 px of map is left between the paddings
  (a banner plus a tall sheet on a short screen), instead of letting `fitBounds` compute a NaN zoom.
- A `ResizeObserver` on `#banner` (`bannerOverDot`) moves the map when a banner shows up over the dot after the first
  fix: within 15 s of `frameNext` it frames dot + next again, later it only pans the dot into the clear. `showBanner` and
  `hideBanner` are NOT edited, so WP2's rewrite of `showBanner` merges without touching this.
- The route fit's 4 s follow timer now pans (`followPan`) when it turns follow back on.
- The off-route line joins the distance and its unit with a no-break space ("120\u00a0m"); `fmtD` itself is unchanged.
  Tests that match that text should use `\s` (JS `\s` matches U+00A0), not a literal space.

## New state (storage invariants kept)
- `DEF` gains `tracking:false` and `voice:false`. `CARRY` gains `'voice'` (WP7 adds `'diet'`).
- `S.tracking` is true between `startTracking` and `stopTracking`; `pagehide` never clears it; Reset keeps it.
- On load, `S` is validated (visited must be a plain object, trail segments/points must be arrays of numbers,
  walked/elapsed finite and >= 0, booleans and labels checked). Valid saves pass through byte-for-byte.
- `arrive()` does `if(S.target===s.id)delete S.target` for WP6.
- New sessionStorage keys: `cnw-nav` (open route: `{from,to}`, each with its own lat/lng) and `cnw-wake-hint`.
  No new localStorage keys.

## For WP4 (offline)
- Offline fast path: in `computeRoute`, after the `early`/pending checks and before `routeAny`, WP4 can do
  `if(navigator.onLine===false){NAV.route=null;routeFailed(opts);return}` (plus `saveNav()` is already done).
  `routeFailed` shows the straight-line mode, the Retry chip and a primary "Open in Amap" (D7 wants `#navNow`
  "straight line" and the Amap chip; both come from there). For a reroute it keeps the old route.
- Boot order is now: `syncSettings… fitAll()`, switched toast, `restoreNav()`, `resumeTracking()`. WP4's `?card=home`
  and SW registration go after that.
- `flush()` is the synchronous save (visibility hidden, `freeze`, `pagehide`). It toasts once if storage is full.

## For WP5/WP6
- `fitAll` frames `STOPS+HOTEL` only.
- `bottomOcc()` = route panel height, else sheet height, else 0. WP6's peek/normal/list states change `sheetH()`
  live, so framing follows automatically. `flyTo` computes `centerAbove` after `toggleList(false)`; when WP6
  replaces `toggleList`, keep the "close list first, then compute the centre" order.
- `navArrived` uses `curNext` after `ui()` for the "Next: … · Route" button; WP6's `S.target`/skip logic in `ui()`
  flows through unchanged.

## Deviations from the spec text (and why)
- `#sumTime` shows two short lines ("about 6 min" / "arrive 21:42") with a visually hidden " · " between them, so the
  text is exactly "about 6 min · arrive 21:42" but fits beside the distance and the Amap chip at 360 px (one line
  was 196 px wide in a 112 px slot and got an ellipsis).
- Off-route text: "Head back to the route: 120 m to the west" (spec), and while a reroute is in flight
  "Off route by 120 m. Finding a new route…" (spec says just "Finding a new route…"; the distance is kept so the
  walker still knows how far off they are). Both come with an arrow pointing to the nearest point of the route.
- Arrival from the route (`navArrived`) ticks the stop only when accuracy <= 35 m, matching the B13 intent;
  "You've arrived" and the Next button show regardless. Eat places never tick.
- Retries after a failed reroute: back-off 20 s, 40 s, 60 s (only while still off the route); after three failures
  the normal off-route trigger continues at 60 s spacing instead of 20 s.
- The 120 s "new trail segment" rule measures the gap between received fixes, not between stored points, so standing
  at a stall for several minutes doesn't split the trail.
- The wake-lock hint is shown once per browser session and never over another banner (it waits for the next start).
  It also waits when a fix clears a location banner ('perm'/'gps') while the wake-lock request is still pending
  (`locMsgAt` vs the request time in `setWake`): the refusal and the first fix race, and without this A9 (deny, then
  grant and start) ended with the hint on screen in about 1 run in 10 under a rejecting wake lock.
- Follow is on hold while a map popup is open (QA round 2): `followPan` and `bannerOverDot` return early while
  `openPop` is set, and the first-fix framing is held (`frameLate`) until the popup closes. Locate's `aria-pressed` is
  `watchId!=null&&follow&&!openPop` (`syncLocate()`, used by `setFollow` and `ui()`), so it shows off while a popup
  holds the map. On `popupclose` follow resumes with one pan (or the held framing), unless another popup opened in the
  same tick, the map was dragged (follow off) or tracking stopped. Locate closes an open popup before centring.
  Merge: if WP2 rewrites `setFollow`/the Locate line in `ui()`, keep `syncLocate()`. If WP6 adds popups or replaces
  the `popupopen`/`popupclose` handlers that set `openPop`, `openPop` must still be set before WP3's handlers run
  (they are registered later in the file). If WP2's `openLayer` ever wraps map popups, Back closing a popup goes through
  `map.closePopup()` and resumes follow the same way.
- Undo on an automatic arrival sticks (QA round 2 observation, not a spec item): the Undo callback puts the id in
  `undone`, and neither the arrival loop in `onPos` nor `navArrived` ticks it again until a fix puts the walker more
  than 60 m from it. In memory only. WP6: if a "skip" or `S.target` change should also clear it, `delete undone[id]`.
- Leaflet drops `setView`/`fitBounds` issued during a running zoom animation; framing calls (`frameNext`, route
  fits, Locate) go through `afterZoomAnim()`, which uses Leaflet's private `map._animatingZoom` (Leaflet is inlined,
  so the version is fixed).
- Leading U-turn in the first 20 m: dropped, its distance added to the start step, and the start step's compass word
  is re-aimed along the route geometry ("Walk north" becomes "Walk south" when the route immediately turns back).
- When routing fails outright, the Amap chip becomes primary (Amap is then the best way to get a street route).
- Restored routes: an end whose id this walk doesn't have, or has for a different place (`hotel` is the Wyndham on
  one walk and the street on the other), loses its id so it gets its own end marker.

## Test harness notes
- Headless Chromium always rejects `navigator.wakeLock.request`; the WP3 harness stubs it to succeed (a phone normally
  grants it) except in X4, which checks the hint. WP1's A9 passes with or without the stub
  (`tests-WP3/fix-r2/a9race.js` makes the refusal land 0-4000 ms late: the banner is always hidden after the first fix,
  and the hint shows on the next start).
- A banner that covers the dot now moves the map. Playwright's POSITION_UNAVAILABLE flash shows the "No GPS signal"
  banner, so a check that the dot "did not move" must measure it against a stop pin, not against the screen.
- Playwright's `setGeolocation` fires a POSITION_UNAVAILABLE error before each new position (the pill flashes
  "No GPS signal"); this also happened before WP3.
