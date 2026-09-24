# Integration notes (merge engineer only; delete before deploy)

Branch `wp5-7-build`. Covers **WP5** (places data model v2, open now, tonight hint). WP2–WP4 are being built separately, and these notes list every point where they touch WP5 code.

## WP5: what changed structurally

- **The `DAYS` literal is replaced by `CATS`, `PLACES`, `DAYS` (id skeleton), the hours engine and `normPlace`**, all at the top of the IIFE. The walk views (`buildWalk`, `HOTEL`, `HOME`, `STOPS`, `EXTRAS`, `EATS`, `NEAR`, `ALL`, `BY`, `PINNED`, `isBase`) now live after the geometry section, because `buildWalk` needs `dist()`.
  - `var DAY_KEY`/`DAY` moved there too.
  - `CARRY`/`carry()` are unchanged and stay where they were.
- **Ids.**
  - The Huangxing Rd base is now `hx-base`, and `HOME` is the `hotel` view: `BY.home = BY.hotel = HOME`, so `data-id="home"` from WP1 still resolves.
  - On the Hotel loop `HOME === HOTEL` (the same object).
  - The H marker is now `markers.hotel`; nothing used `markers.home`.
  - All 22 existing place ids are byte-identical.
- **`S.skip`** is a new per-walk field with default `skip:{}` in `DEF`.
  - After load it is copied into its own object, so `DEF.skip` is never mutated.
  - Reset sets `skip:{}`.
  - It is **not** in `CARRY`, on purpose.
  - WP3.5's `flush()`/validation should also sanity-check `skip` (plain object, else `{}`); the post-load line after `if(!Array.isArray(S.trail))` already does this.
- **New optional place field `hoursFor`** (a spec deviation, see below). It is documented in the comment above `PLACES`.
- **`last` may list one last-entry time per session** (`last:['18:00','21:30']`, or `"18:00,21:30"`), a spec extension (see deviation 2). A single `"HH:MM"` works as before. `p._last` is now always an array of minutes; `hoursAt(h,t,last)` takes that array.
- **Pin stacking (fix round 1).** `pinRank(s)` gives every walk pin a `zIndexOffset`: next 1000, base (★/H) 600, stops 500 (done 350), detours 300 (done 250), places to eat 200. `nudgePins()` runs on `zoomend` and inside `refreshPins()`. It moves an eat, detour or base pin by up to 24 px (via its `iconAnchor`/`popupAnchor`, recorded in `NUDGE`) when it would otherwise sit under a stop or the next pin. Stops and the next pin never move. This only happens at overview zooms (Chayan Yuese is 35 m from Nanmenkou, which is 4 px at z13), and nothing moves at z17. See deviation 14.

## Hooks and guards WP2–WP4 need to know about

WP5 calls no WP2/WP3 functions, so there are no `typeof` guards. What does interact:

### WP2

- **`--gold-text`.** `.oh[data-s=soon]` uses `color:var(--gold-text,var(--gold))`. Once WP2 defines `--gold-text`, the fallback can go. Include `.oh` (all four states, on `--panel-2`) and `.badge` in WP2's B2 contrast checks: `--jade` on `--panel-2` in light mode is borderline.
- **`lang="zh-CN"` (WP2.4).**
  - `rowHtml` and `popupHtml` were rewritten by WP5. They now escape with `esc()` and add `.pills`/`.hrs`/`.pop-body`.
  - Re-apply the lang attribute on the `.zh` divs in both, and on `.zh` in the picker.
  - Expect textual merge conflicts on these two functions and on `ui()`'s row loop.
- **Toasts.** The skip toast goes through `toast(msg,'Undo',fn)`, so WP2's `say()` inside `toast` covers it. No extra call is needed.
- **44 px targets (WP2.3).**
  - `#hint` can now contain a `.chip` (Skip / Route) and is laid out as `display:flex` when it is a warning (`.hint.warn`), so a 44 px chip sits beside the text instead of inflating the line.
  - Popups and rows have new `.pills`/`.badge` spans; these are not buttons.
- **Next card, `.meta`.** The new rule `.meta>span:empty{display:none}` removes the column gap an empty `#nextDir`/`#nextTime` left in front of the pill. If WP2 puts an sr-only span into `.meta`, give it text or put it outside `.meta`.
- **Popup scroll rule.** The WP1 rule `.leaflet-popup-scrolled .pop>p{…}` became `.leaflet-popup-scrolled .pop>.pop-body{…}`. Since fix round 2 only the hours text and blurb scroll in a capped popup; name, `.pills`, distance and chips stay fixed. If WP2 edits that CSS line, keep `.pop-body`.
- **Popup fit (fix round 2) and 44 px chips (WP2.3).** `popupopen` now ends with `fitPop(e.popup)` instead of `e.popup.update()`; keep that call if WP2/WP3 rewrite the handler. `fitPop` measures whether `.acts` still fits inside the capped content box and, if not, adds classes to Leaflet's content node one at a time (`pop-c`, `pop-t`, `pop-p`, `pop-x`, then `pop-nb`; see the comment above `POPFIT`).
  - WP2's `.chip{min-height:44px;padding:0 14px}` plus `.acts{gap:8px}` makes the three stop chips (Route, Driver card, Done) wrap onto two rows in a 251 px popup (360 wide) and a 266 px one (375 wide). With the closed sheet at 360×640 and 375×667, the chips then overflow the cap **even on the WP1 commit**, and `fitPop` sheds everything it can before it still clips them.
  - Measured with `scratchpad/tests57/fix2/pop_probe.js`: without WP2 it passes 0 bad at 360×640, 375×667 and 360×780. With `CHIP44=1` (WP2's chip CSS injected) 10 of 26 cases clip.
  - Options for the merge: give popup chips less horizontal padding (`.pop .acts .chip{padding:0 10px}`, `gap:6px`) so three chips fit on one row; or let WP6's peek sheet state give popups more height. Re-run the probe with and without `CHIP44=1` after the merge. WP6's "Make next" and WP7's "Order" chips add to `.acts` too.

### WP3

- **Hours on dates (fix round 2).** `hoursAt` now resolves a week-minute to a China calendar day (`dayBase`, nearest to today) when the hours carry a `PH` or dated rule (`h.x`). WP3 does not touch this, but any code that calls `openState(p, at, now)` with an `at` more than 3 days from today would map to the wrong week; nothing does.
- **`drawRoute` end markers.** The condition is now `!(NAV.to.id&&markers[NAV.to.id])` (same for `from`), so a "More nearby" destination, which has no pin, gets the red end dot. Keep this when WP3 rewrites `drawRoute`/`computeRoute`.
- **Auto-arrival (WP3.4).**
  - `NEAR` places are not in `ALL`, so they never auto-tick. They also carry `eat:true`.
  - `toggleVisit` refuses `role==='near'` and any base (`isBase(BY[id])`, per WP5.1).
  - WP3's "clear `S.target`" belongs to WP6.
- **`updateNav` "Next: ‹name›" chaining (WP3.1)** should skip `S.skip[id]` stops, the same way `ui()` now does when choosing `curNext`.
- **`flush()`** persists `S.skip` automatically, since it is part of `S`.
- **Markers.** If WP3 touches marker creation or `refreshPins`, keep `zIndexOffset:pinRank(s)`, the `setZIndexOffset` call in `refreshPins`, and the `map.on('zoomend',…nudgePins…)` handler. `pinIcon` reads `NUDGE[s.id]` for its anchors. WP3's `centerAbove`/follow logic is unaffected: nudges are icon offsets only, and marker latlngs don't change.
- **Compass on the dial (WP3).** List-open height (WP1 A2) depends on the next card's height. With the list open, WP5 now hides `#nextOh` and keeps `#nextZh` to one line (`.sheet.list-open #nextOh`, `.sheet.list-open #nextZh`). Re-run A2 at 360×640 (≥ 140) and 375×667 (≥ 150) after the dial change. `scratchpad/tests57/fix1/a2_probe.js` covers the evening states where the pill shows.
- **The 1 s interval** now also calls `ui()` once per minute (`hoursMin`) to re-evaluate the open/closing pills and the tonight line. WP3's watchdog goes in the same interval; keep both.

### WP4

- There are no WP5-specific changes.
- `?card=home` (WP4.9) still resolves through `BY.home`.
- The service worker should cache `index.html` as usual; all data is inline.

### WP6 (next in this branch; noted for completeness)

- **Next-stop choice** in `ui()` is `!S.visited[id] && !S.skip[id]`. WP6.5 adds `S.target` on top.
- **Rows.** `ui()` writes each row's pills into `.pills` (cached in `row._ph`) for `ALL.concat(NEAR)`. If WP6 restructures `rowHtml`, keep a `.pills` container or update `ui()`. The hidden `[data-act=unskip]` chip exists only on stop rows. Eat rows still have Done in WP5; WP6 F7 removes it.
- **Sheet states (WP6.1).** Keep `.sheet.list-open #nextOh{display:none}` and the one-line `#nextZh` for the list state, or an equivalent, so A2 holds with a pill showing. If the peek state shows the next card, the same applies there.
- **`NEAR` pins and the nudge.** `nudgePins()` only covers `PINNED`. When WP6 adds "More nearby" pins, give them a `zIndexOffset` below 200. Either add them to the nudge list (as movable pins) or leave them un-nudged under the walk pins.
- **`NEAR` pins.** `flyTo()` falls back to a stand-alone `L.popup` when `markers[id]` is missing, and `drawRoute` draws an end dot for pinless ends. If WP6 keeps "More nearby" pins in a separate `nearLayer`/map, either register them in `markers` or update those two lookups.
- **Picker.** It still lists only `HOME`, `HOTEL`, `STOPS`, `EXTRAS`, `EATS`; WP6.6 adds `NEAR` and `tags`. The "Your hotel" label now shows only when `HOME!==HOTEL`, which matches the old `DAY!=='today'` behaviour.

### WP7 (data it can rely on)

- **`hotel`:** `addr` 长沙市芙蓉区芙蓉中路二段106号 (from a listing; the comment says to verify it at check-in), plus `tel`.
- **`hx-base`:** `taxi:{zh:'黄兴广场（黄兴路步行街）',…}` (G2).
- **`order` lists** on:
  - the four eats; `eat-huogong` has 臭豆腐 and 糖油粑粑 for G3;
  - `wenheyou`/`eat-wenheyou` (via `ref`);
  - most food places in "More nearby".
- **`mods`** on `eat-chayan`.
- **`orderTip`** where a verified source supports one.
- **Omitted on purpose** because no verified source names them: 三鲜豆皮, 声声乌龙, 嗦螺, and 糖油粑粑 at Wenheyou. `spice` is set only where a source says "very spicy". No `veg` flags. Prices appear only where a source gives them, always with "~".
- **`#btnHelp` (WP7 item 3)** is not part of WP5 and was not added here.

## Deviations from the spec (and why)

1. **Tianxin (`tianxin`/`hx-tianxin`) has no machine `hours`.**
   - The re-check found the paid night session runs 18:00–22:00 (last entry 21:30) in winter but 18:30–22:30 (last entry 22:00) in summer, and the switch date isn't published.
   - The park, which is the reason to come at night, stays open until midnight.
   - A pill could be wrong in either direction, so the stop has a `hoursText` line with both schedules and the blurb states both last-entry times.
2. **Du Fu uses the verified split sessions:** `Mo 09:00-22:00; Tu-Su 09:00-18:30,19:00-22:00` with `last:['18:00','21:30']` (one last entry per session), plus a new field `hoursFor:'Inside'`.
   - Why the list: the re-check gives the Tue–Sun day session as 9:00–18:30 with last entry 18:00, and the night show as 19:00–22:00 with last entry 21:30. One `last` value could not express both. Fix round 1 replaced the old `last:'21:30'`, which let the pill read "closes 18:30 · in 20 min" at 18:10.
   - Each last entry applies to the range it falls inside. If two fall inside one range, the later one counts. That is Monday's 09:00–22:00, which uses 21:30, as Qunar lists.
   - The pill reads "Inside: open · last entry 18:00", then "Inside: last entry 18:00 · in 20 min". From 18:00 it reads "Inside: past last entry · opens 19:00", then "Inside: closed · opens 19:00", then "Inside: open · last entry 21:30".
   - Tonight line (a) never suggests Skip for a `hoursFor` place, because the free riverside and the floodlit pavilion are still worth the walk.
   - Tonight line (b) still warns about the night show's 21:30 last entry. It does not warn about a deadline that has a later session the same day (`openState(...).reopens`): the day session's 18:00 is not the last chance tonight. So from 17:00 to 19:00 it does not send the walker to Du Fu at all.
3. **Tonight line (b) qualifies and ranks stops differently.**
   - A stop qualifies when its deadline (last entry, else close) is within 60 min.
   - Stops are ranked by closing time, with ties going to loop order, as the spec says.
   - This keeps E5 ("IFS closes 22:00" beats Du Fu at 21:10) while Du Fu's earlier last entry is still reported once IFS is done.
   - A stop that would be closed on arrival (when GPS is on) is excluded from (b).
4. **Row and popup pills are evaluated at arrival time, like the next card**, when there is a fix; without one, "now" is used. They read "Closed when you arrive" when relevant.
5. **The next-card pill uses a short text** (`openState(...).short`), because the full text wraps in the narrow column and makes the sheet jump on the minute tick. Rows and popups use the full spec text. The tonight line carries the countdown.
   - Short texts: "Open till 22:00", "Last entry 21:30", "Closes 22:00", "Closed till 17:00", "Closed till tomorrow", "Closed till Wed", "Reopens 19:00" and "Past last entry".
   - "Closed when you arrive" keeps the spec wording. At 360 px with the headless test font it still wraps to two lines; with phone system fonts it is narrower.
   - With the list open, the pill is hidden and `#nextZh` is one line with an ellipsis. The rows show both in full, and this keeps WP1 A2: `#list` is 149 px at 360×640 and at least 176 px at 375×667 in every evening state tested.
6. **Closed texts.**
   - "Closed today" is used only when the day has no hours at all.
   - Otherwise the text is "Closed · opens 09:00", "Closed · opens 09:00 tomorrow" or "Closed · opens Wed 09:00".
   - After the last entry, it is "Past last entry · opens 19:00" when a later session starts that day, and otherwise "Past last entry (21:30)".
   - Tonight line (a) for a non-`hoursFor` stop reads "‹Stop›: last entry was 18:00, reopens 19:00" in the same case.
7. **Tonight-line layout.** The line is text plus a chip on the right (flex) rather than an inline "· Route", which saved a text line at 360 px.
8. **Short names and tonight-line text.** `ifs`/`hx-ifs` have `short:'Changsha IFS'`, so the line reads "Changsha IFS closes 22:00 (in 50 min, 10 min walk)". E5's "IFS closes 22:00" substring holds.
9. **Values that differ from the spec's §3.9 table**, taken from the independent re-checks in `places_verified.json`:
   - **Pins moved:**
     - `hx-nanmen` → 28.183664,112.97617 (88 m; the junction at the street's south end)
     - `hx-wenmiao` → 28.184874,112.97183 (20 m; the archway)
     - `eat-huogong` → 28.190186,112.973853 (17 m)
   - **Chinese names corrected:**
     - `ifs` 长沙IFS国金中心
     - `hx-jiayi` 太平老街
     - `hx-wenmiao` 西文庙坪牌坊 (English name now "Xiwenmiaoping archway")
     - `wenheyou` 长沙文和友（海信广场店）
     - `eat-chayan` 茶颜悦色（南门口步行街店）
   - **Tianxin address:** 天心路17号.
   - **Du Fu:** day ticket ¥18 (not ¥11); separate night show ~¥58.
   - **Wenheyou:** ¥90–130 (lvl 3), not ¥86.
   - **Huogongdian:** `late` false, with hoursText "About 08:00–22:00".
   - **Chaozong:** `late` true; the verdict called late:false doubtful.
   - **Orange Isle:** `last:'21:00'` (stated in the bridge verdict).
   - **Hualongchi price:** "Bars about ¥50–200 per person"; no per-drink prices exist.
10. **New places.**
    - 22 verified places were added with `p-` ids: 25, minus Huogongdian and Fei Da Chu (merged into the existing ids), minus the duplicate Tianbao Brothers.
    - The 5 dropped places are absent.
    - Hours are machine-readable only where a current listing clearly supports them:
      - Juwei Quji, Wu Aijie (Baidu 09:30–23:30), Jinji, Xiaji, Mengzhong, Yulou Dong (Dianping), Xia Xiaolong, the ferris wheel and First Normal
      - Xia Xiaolong uses the branch's own listing, `Mo-Su 11:30-02:00` (Trip.com, per the verdict). Its hoursText says the chain's flagship breaks 14:30–17:00, so this branch may too. Fix round 1 removed the earlier "conservative split" taken from the flagship: it made the pill claim "closed" in the afternoon, which no source says for this branch.
      - also Wenheyou, IFS, Chayan, Bamboo Slips and Orange Isle
    - Everything else uses `hoursText`.
    - `conf:'low'` is set only for the river cruise (pier position and passport acceptance unconfirmed), which shows an "Unverified" badge and no pill.
    - Juwei Quji is `high` because the verdict found a live listing.
    - Walk times in these blurbs say "from Huangxing Rd", because "More nearby" also shows on the Hotel loop.
11. **"More nearby" rows.**
    - They have Map · Route · Driver card and no Done.
    - Map opens a stand-alone popup, since pins come with WP6.
    - They get live distances when tracking.
12. **Transport (tonight line c)** is implemented. It uses the nearest `cat:'transport'` place with `last` as the last train, shown 22:45–01:00. There is no data yet: the spec says metro stations need on-site checks.
13. **List note.** "Hours checked Sep 2026; holidays may differ." is a second `.note` paragraph.
14. **Pin nudge at overview zoom (fix round 1).** Spec R15 rejects a declutter algorithm, and this is not one: no clustering, no zoom tiers, no labels. It is a local fix for one regression the verified coordinates caused. `hx-nanmen` moved 88 m north and is now 35 m from `eat-chayan`, so at z13–z14 the Chayan pin hid under pin 1 (or covered it) and pin 1 covered the ★.
    - The pin ranks alone keep pin 1 on top everywhere.
    - The nudge makes Chayan visible beside pin 1 and keeps the ★ centre clear. It also separates the Pozi Street 🍜 pins at z14.
    - Measured on the Huangxing Rd overview (tappable samples, `scratchpad/tests57/fix1/pins_probe.js`):
      - pin 1: 25/25 at every size;
      - ★: 25/25;
      - Chayan: 22/25 at 360×780, 390×844 and 412×915, and 15/25 at 375×667 and 360×640 (HEAD: 9/25 and 2/25).
    - The Hotel loop has no nudges.

15. **Public holidays and dated rules in the hours grammar (fix round 2).** §3.4 has no dates, so a verified museum notice (Bamboo Slips closed Thu 8 Oct 2026 in lieu of opening over National Day) left the pill saying "Open". The grammar now also takes, as day selectors:
    - `PH`: the dates in `HOLIDAYS`, from the State Council notice for 2026. These are Mid-Autumn, 25–27 Sep, and National Day, 1–7 Oct. The make-up working days, Sun 20 Sep and Sat 10 Oct, are not modelled.
    - An ISO date, `YYYY-MM-DD`: one China calendar date.
    - As before, the last rule that names a day wins. `h.w` is still the ordinary week, so code that reads it (`lateTonight` fallback, QA harnesses) keeps working. `dayRs(h, n)` gives a calendar day's ranges.
    - Data changes:
      - `hx-jiandu`: `Tu off; Mo,We-Su,PH 09:00-17:00; 2026-10-08 off`. Its hoursText names Tue 6 Oct and Thu 8 Oct.
      - `p-first-normal`: `Mo off; Tu-Su,PH 09:00-17:00`.
      - `p-ferris-wheel`: `Mo-Fr 18:30-22:30; Sa,Su,PH 09:30-22:30`. It gets a hoursText line with the 12:00 weekend start that one listing gives. The blurb now says "weekends and public holidays".
      - `dufu` (and `hx-dufu` via `ref`): `Mo 09:00-22:00; Tu-Su,PH 09:00-18:30,19:00-22:00`. The river-cruise re-check says there is no Monday night show "except on public holidays".
    - `HOLIDAYS` has to be extended when the next year's notice is out. After 7 Oct 2026, `PH` matches nothing and the weekly rules apply.
    - **Watch out when extending it with Spring Festival:** Bamboo Slips is closed on Lunar New Year's Eve and the first two days of the New Year. Its `PH` rule would then claim those days open, so add dated `off` rules after the `PH` rule, e.g. `…; 2027-02-05,2027-02-06,2027-02-07 off`, once the dates are confirmed.
    - QA's `honesty.js` sweeps the week around the real "now". Its truth tables are weekly, so in the week of 24 Sep 2026 it flags the ferris wheel opening at 09:30 on Fri 25 Sep, which is correct because that day is the Mid-Autumn holiday. With the clock set to an ordinary week, `fix2/honesty_at.js` (`AT=2026-09-17T04:00:00Z` or `AT=2026-10-15T04:00:00Z`) passes 75/75.
16. **Popups keep their pills whole on short phones (fix round 2).**
    - `.pills` moved out of `.pop-body`. It is now a direct child of `.pop`, between `.zh` and `.pop-body`, and it is fixed (`flex:none`) in a capped popup.
    - `fitPop()` sheds, in order, only while the chips would be cut off:
      1. The price words and an "Open late" that repeats the pill's own close time (≥ 23:00). The price badge becomes `<span class="sym">` + `<span class="ptx">`, textContent unchanged, and the words move into a `.ptxt` line at the top of the body.
      2. The name's second line (ellipsis) and some spacing.
      3. The price and "Open late" badges. The open/closed pill, "Unverified" and "Skipped" always stay.
      4. The distance line.
    - A body left under 32 px is dropped (`pop-nb`) instead of showing a masked sliver. The list row still has the hours text and blurb.
    - A capped popup takes its full `maxWidth`, because Leaflet measures width while the old capped height is still set.
    - Rows are unchanged, apart from a `red` class on a redundant "Open late" badge, which has no effect outside compact popups.
    - Harnesses that looked for `.pop-body .pills` should use `.pop .pills`.

## Tests

The tests are in `scratchpad/tests57/`:

- `wp5.js`: E1–E7 plus extra checks, including X_wp1delta, which re-runs the WP1 checks whose ids WP5 changed by spec.
- `r0.js`
- `wp1_on_wp57.js`: the original WP1 suite. It uses `scratchpad/tests/lib.js`, which serves `/home/user/Test/index.html` unless `APP_FILE` is set, so run it with `APP_FILE=/home/user/Test-wp57/index.html`. (The "131/131" noted after fix round 1 was measured without `APP_FILE`, so it tested the other tree.) Against this file it gives 122/128, both before and after fix round 2. The 6 failures are WP1 expectations that WP5 changed by spec: 29 opt rows, `data-id="home"` in the picker and chips (now `hotel`), and the p- ids after the walk rows. `wp5.js` `X_wp1delta` re-checks them with the new ids. The merge engineer should update any selector that uses picker `data-id="home"`.
- `fix2/`: fix round 2. It holds `holidays2.js` (PH and dated rules through the rows and the engine, 32 checks), `pop_probe.js` (capped popups at 375×667, 360×640 and 360×780; `CHIP44=1` injects WP2's chip CSS), `honesty_at.js` (QA's honesty sweep with a fixed clock, `AT=…`), and `run_all.sh` (builder and QA suites).
- `fix1/`: fix round 1 probes. It holds `hours_probe.js` (Du Fu, Xia Xiaolong and the tonight line at frozen China times), `a2_probe.js` (list-open `#list` height and next-card height in 11 evening states at 4 sizes), `pins_probe.js` and `pins_zoomshot.js` (pin stacking and nudges), `nudge_popup.js` (the popup anchor on a nudged pin), and `run_all.sh` (the builder and QA suites in parallel).
