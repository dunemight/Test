# Known issues (open as of 2026-09-25)

Work stopped here. The live version passes every scripted acceptance check (stages 1–7), but the final visual review and the end-to-end walk test found the issues below. None of them are fixed yet.

- **Map framing.** At 375×667, if the "can't keep the screen on" banner is showing, the first GPS fix zooms out to about z13.
- **Undo after an arrival.** When you undo an auto-arrival, the stop can re-tick before you've walked away.
- **Switching walks while tracking** (375×667) has glitches.
- **Sheet access during a route.** Done, All stops, Eat & drink and the walk switch are hard to reach.
- **Arrival consistency.** The stop tick and the route panel can disagree about arrival.
- **Last-leg instruction** wording.
- **Track and GPX.** Track/GPX integrity issues. Standing still still adds walked distance.
- **Route recovery.** Recovery after a failed initial route, and after a reload mid-route while offline.
- **Status indicators** have minor visual glitches.
