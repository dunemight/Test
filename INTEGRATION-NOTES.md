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
