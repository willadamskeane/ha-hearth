# Changelog

## 0.1.23

- Keep the status strip and page labels on small wall tablets such as the ThinkSmart View (788x492 CSS px). Upstream's phone-held-sideways layout matched any landscape screen up to 500 px tall; it now stops at 440 px, above the tallest phones.

## 0.1.22

- Merge upstream Hearth 0.3.0 (see "Upstream 0.3.0 (merged)" below): clearer connection and config errors, one entity detail sheet everywhere, back-button closing, drag-to-set cover tiles, theme-token surfaces, editor improvements and more translations.
- Keep the fork's status strip, scoped entity subscriptions, scroll-safe taps, camera grid and Ingress login; on narrow screens the strip replaces upstream's rail section above the page, except on a phone held sideways.
- Load the setup wizard and sign-in sheet only when needed, keeping the main bundle within budget.

## Upstream 0.3.0 (merged)

Changes from upstream [knowald/ha-hearth](https://github.com/knowald/ha-hearth) 0.1.1 through 0.3.0 (upstream 0.1.0 is the shared base, listed as 0.1.0 at the bottom), merged into this fork in 0.1.22. Upstream's version numbers overlap the fork's 0.1.x releases below; the headings here are upstream's. Where both sides changed the same behaviour, the fork's behaviour was kept (see the merge commit).

### Upstream [0.3.0] - 2026-09-23

#### Changed

- Show why the connection fails on the boot screen after a few attempts, with a hint for the cause and a Retry button, instead of spinning forever ([`23f870f`](https://github.com/knowald/ha-hearth/commit/23f870f))
- Keep the sign-in sheet open until Home Assistant accepts the token, say so when it rejects one, and call the action "Sign in" everywhere ([`23f870f`](https://github.com/knowald/ha-hearth/commit/23f870f))
- Explain an unreadable, invalid or unsupported `hearth.yaml` and an unreadable `configuration.yaml` in the load-error banner, with a Reload button ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b))
- Tell a degraded Home Assistant connection, where some data may be stale, apart from a lost one ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b))
- Keep the first-run area import open on a stray backdrop tap and offer Skip for now ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b))
- Move the area import from the edit bar to the Settings sheet, and offer it on an empty home page until the dashboard is set up ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b), [`153a411`](https://github.com/knowald/ha-hearth/commit/153a411))
- Open the same detail sheet for an entity from every tile, search result and widget, headed by its translated domain name and configured icon ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Send a cleaning or returning vacuum home from every surface, and offer the same actions in its detail sheet and popover ([`15a5e62`](https://github.com/knowald/ha-hearth/commit/15a5e62), [`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Ask before unlocking or opening a lock but not before locking it, on the tile and in the detail sheet alike ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Label each editor sheet's header action by what it does: Close, Done, Apply or Save ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Confirm destructive editor actions with the same dialog everywhere, including leaving edit mode with unsaved changes, and stop asking before a stack is unwrapped ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Share one visibility section and one live preview between the card and widget editors ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Show whole readings without a decimal ("21" rather than "21.0") and use the Home Assistant temperature unit on every surface ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Build a page list into a wide rail that has no visible navigation widget, so pages can always be changed ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4), [`bea0e74`](https://github.com/knowald/ha-hearth/commit/bea0e74))
- Close the top popup, sheet or search with the browser or Android back button, and keep the current page in `?room=` ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Show search as a full-width sheet on phones ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Let only the edit chip react on rail widgets while editing ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Hide rail widgets with nothing to show, show "-" for an unavailable entity instead of a made-up reading, and keep a dimmed placeholder while editing ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Stop all motion, including the pending pulse and the press scale, when reduced motion is set in Hearth or the operating system ([`ede2b06`](https://github.com/knowald/ha-hearth/commit/ede2b06))
- Draw shadows, card surfaces, spacing and faint fills from theme tokens, so light themes keep their tints and cards share one shape ([`ede2b06`](https://github.com/knowald/ha-hearth/commit/ede2b06))
- Store interface copy in sentence case, call dashboard pages "pages" throughout, and translate option labels, theme names and placeholders that were English only ([`7d403bf`](https://github.com/knowald/ha-hearth/commit/7d403bf))

#### Added

- Drag a cover tile sideways to set its position, like a light tile sets brightness ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Control popup sliders from the keyboard ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Add move up and move down to the card, widget and stack editors ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Add hints and inline errors to editor fields ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Offer Overwrite and Reload when application settings were changed in another tab ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Open entity detail from weather, chart, status, energy and calendar widgets ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))

#### Fixed

- Show the sign-in button on the boot screen only when a long-lived token is needed ([`5f99973`](https://github.com/knowald/ha-hearth/commit/5f99973))
- Keep a tap that closes search or wakes the screensaver from reaching the tile underneath ([`70c21a8`](https://github.com/knowald/ha-hearth/commit/70c21a8))
- Show command errors and the connection banner above open popups and sheets ([`5235598`](https://github.com/knowald/ha-hearth/commit/5235598))
- Accept taps on scenes, buttons and scripts that have not run yet and report `unknown` ([`5b3af77`](https://github.com/knowald/ha-hearth/commit/5b3af77))
- Confirm every garage door and gate move, from the tile, popup, slider and group actions, and send the direction that was confirmed ([`5b3af77`](https://github.com/knowald/ha-hearth/commit/5b3af77), [`6cda91b`](https://github.com/knowald/ha-hearth/commit/6cda91b))
- Open the media popup for media players from tiles and search ([`38d52ca`](https://github.com/knowald/ha-hearth/commit/38d52ca))
- Apply custom CSS without reloading the page, which dropped unsaved dashboard edits ([`e58f5d2`](https://github.com/knowald/ha-hearth/commit/e58f5d2))
- Keep Ctrl-S in an open editor sheet from opening the browser's save dialog ([`e58f5d2`](https://github.com/knowald/ha-hearth/commit/e58f5d2))
- Ask before dropping staged application settings ([`5581ef1`](https://github.com/knowald/ha-hearth/commit/5581ef1))
- Leave no empty stack behind when adding one is cancelled ([`b68bbb0`](https://github.com/knowald/ha-hearth/commit/b68bbb0))
- Apply the theme sheet's day/night switch fields as they change, like its other fields ([`e571b87`](https://github.com/knowald/ha-hearth/commit/e571b87))
- Keep read-only tiles from opening controls ([`b4b39dc`](https://github.com/knowald/ha-hearth/commit/b4b39dc))
- Let detail sliders reach every step of the entity ([`a5bafa2`](https://github.com/knowald/ha-hearth/commit/a5bafa2))
- Show climate and fan changes at once and pulse the control that was pressed until Home Assistant confirms ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Restore a `?theme=` preset once editing ends ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Copy edits as YAML, with Copied or Copy failed feedback instead of reporting a failed save ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Return from Versions to the configuration editor and from there to Settings ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Trap and restore keyboard focus in every popup, sheet and dialog ([`ede2b06`](https://github.com/knowald/ha-hearth/commit/ede2b06))

### Upstream [0.2.0] - 2026-09-22

#### Changed

- Overhaul the import from Home Assistant: pages carry the area's own icon, floor grouping and registered temperature and humidity sensors, and split into Lighting, Covers, Devices, thermostat, media and camera cards instead of one Lighting and one Devices grid
- Place imported rail suggestions above the flexible spacer instead of below it, skip the ones the rail already covers, and propose a weather widget
- Write the template widget's Jinja in a code editor with highlighting; the plain box it replaces validated the template as YAML and reported a correct template as broken
- Rework the phone layout: the clock and weather ride above the page and the other widgets follow it, `mobile: top | bottom | hidden` on a widget overrides that, and a rail with a flexible gap in the middle is split there; `hide_mobile` still reads as `mobile: hidden`
- Fold every overlay to full width at the same place the rail folds; control popups and the edit bar changed shape at 700px and edit sheets at 820px
- Shed the page labels from all but the current page when a phone is held sideways, and keep the whole rail below the page there

#### Added

- Export the dashboard to a YAML file and import one back from the configuration editor
- Add Versions to the Settings sheet: the snapshots every save keeps are listed, shown as a diff against the open dashboard, and can be downloaded or restored as an ordinary, undoable edit
- Apply the configuration editor with Ctrl-S
- Choose between adding the areas Hearth has no page for and replacing the existing pages when importing, with a confirmation before anything is removed

#### Fixed

- Draw the keyboard focus ring around a framed text field (the search box, the padding steppers, the icon filter) instead of around the bare input inside it
- Keep text pushed into the configuration editor, such as an imported file, while the editor is still loading
- Skip config and diagnostic entities, and entities left behind by a removed integration, when importing an area
- Include camera-only areas when importing from Home Assistant
- Save the import when it runs outside edit mode; it was kept in memory only, so a reload dropped it
- Open a page at its own top rather than at the scroll offset left behind by the page before it
- Make the phone page switcher opaque, so the page no longer shows through the pills, and stop content landing underneath it
- Give the phone layout the side padding the wide one has
- Reach under device cutouts by adding `viewport-fit=cover`, without which every safe-area inset resolved to zero; landscape notches now inset the sides too
- Give the timer widget's buttons a thumb-sized hit area, and stop the dashboard scrolling sideways on a phone
- Keep a widget where it was dropped when it is dragged from one side of the phone layout to the other, and keep a widget hidden on mobile hidden when the widgets around it move
- Keep an unapplied YAML edit when Versions is opened from the configuration editor, and add a way back to it

### Upstream [0.1.3] - 2026-09-21

#### Fixed

- Reuse the Home Assistant panel's login when Hearth is opened as an app (`/app/...`) instead of starting OAuth inside the iframe

### Upstream [0.1.2] - 2026-09-21

#### Fixed

- Log in through Nabu Casa Ingress by using the forwarded Home Assistant origin and an explicit Ingress OAuth redirect URL

### Upstream [0.1.1] - 2026-09-21

#### Added

- Add `HASS_PUBLIC_URL` for direct access when the server uses an internal Home Assistant address

#### Fixed

- Log in through HTTPS Ingress and Nabu Casa by using the browser's Home Assistant origin
- Recover from expired or consumed login codes, and keep room, theme and kiosk settings after login
- Pin the CodeMirror dependency to the editor API the configuration editor and type checks use

[0.3.0]: https://github.com/knowald/ha-hearth/releases/tag/0.3.0
[0.2.0]: https://github.com/knowald/ha-hearth/releases/tag/0.2.0
[0.1.3]: https://github.com/knowald/ha-hearth/releases/tag/0.1.3
[0.1.2]: https://github.com/knowald/ha-hearth/releases/tag/0.1.2
[0.1.1]: https://github.com/knowald/ha-hearth/releases/tag/0.1.1

## 0.1.21

- Play live camera views over WebRTC when Home Assistant offers it. Home Assistant no longer reports a camera's stream type as an attribute, so Hearth always fell back to HLS, which takes about 8 s to start from cold; it now asks Home Assistant which stream types a camera supports.

## 0.1.20

- Fix camera grid snapshots showing in the right half of their tiles.

## 0.1.19

- The camera card can show several cameras (`entities: [...]`) as a two-column grid of snapshots. Each is named, and tapping one opens its live view. A single camera works as before.

## 0.1.18

- Stop scrolling from toggling lights: tiles act on a real tap only, meaning one that stays within 10px either way and that the browser doesn't treat as a scroll. A touch that lands while the page is scrolling, or within 300ms of it, presses nothing, and touch ripples wait a moment so tiles don't flash under a passing finger. Mouse and keyboard work as before.

## 0.1.17

- Subscribe only to the entities a dashboard shows instead of every entity in the house, widening to everything while editing, searching or setting up. On a large house this removes most idle script work and makes page loads lighter.
- Build light and cover tiles directly, skip the visibility gate for cards without conditions, and cache number and calendar-time formatters: cheaper page switches on slow tablets.

## 0.1.16

- Open pages faster on slow tablets: columns build their first two cards before the first frame and the rest right after, SortableJS is only set up while editing, and date/time formatters are cached instead of rebuilt every second. On the ThinkSmart View benchmark, long tasks while switching pages drop by about half.

## 0.1.15

- Add an opt-in performance overlay (`perf_overlay: true` in the dashboard config, or `?perf=1`) showing frame pacing, long tasks by frame, the scripts behind long frames, per-tap timings and the entity update rate. It loads only when enabled.

## 0.1.14

- Move the narrow-layout edit toggle from the end of the page tabs to the end of the status strip, giving the tabs their full width back. Without strip widgets it stays beside the tabs; `?menu=false` still hides it.

## 0.1.13

- Clip the narrow-layout status strip only sideways, so the clock and chip borders are no longer cut at the top on wall tablets.

## 0.1.12

- Show the rail's clock, weather, energy, activity and next-event widgets as a one-line status strip above the page tabs on narrow screens, instead of stacking the whole rail below every page. A rail with nothing else left no longer renders below the page; edit mode keeps the full rail, and `hide_mobile` still hides a widget in both places.

## 0.1.11

- Compact the room header on narrow screens. Where the rail folds away, the icon tile, title and temperature/humidity chips drop to a smaller size and sit closer to the cards, so a wall tablet spends less of its height on the room name the page strip already shows.

## 0.1.10

- Move the edit toggle into the page strip on narrow screens. Below the 900px breakpoint the rail folds away, and the toggle it anchored at the bottom-left corner floated over the first column's tiles on a wall tablet. It is now a pencil button beside search; `?menu=false` still hides it.

## 0.1.9

- Scale the rail energy reading into kWh. Recorder statistics carry the entity's own unit, so a sensor measured in Wh summed to a Wh total while the widget labelled it kWh: today's 7.2 kWh of solar production read as `7234.0 kWh`.
- Word contact sensors as Open/Closed instead of On/Off. Doors, windows, garage doors and openings now read the way Home Assistant words them.

## 0.1.8

- Recognize Home Assistant Ingress even when Kiosk Satellite rewrites the browser route. Hearth now uses the live proxy origin for the shared Home Assistant session, restoring Voice Satellite and `yo billy` wake-word handling after app restarts.

## 0.1.7

- Fade scroll edges into the page background in low-power mode instead of the surface token. The old fallback painted a 72%-opaque near-white veil over dark presets, which read as a glow across the bottom row rather than a hint that content continues.

## 0.1.6

- Keep the room tabs on their own 12px inset instead of adding the container padding on top. The tab strip already bleeds past the layout's edge padding, so inheriting it pushed a pill off the end on a wall tablet.

## 0.1.5

- Hide the Home Assistant panel title bar above the Ingress frame so wall tablets get the full screen height. The frame now asks the hosting frontend to enter kiosk mode on start, which is the only supported way to remove chrome that Home Assistant draws in its own `ha-panel-app` shadow root.

## 0.1.4

- Add an automatic low-power rendering mode for older Android kiosks, removing progressive backdrop blurs, animated drop shadows and other expensive compositor effects while preserving the full visual mode on capable clients.
- Coalesce Home Assistant state bursts to animation frames and subscribe runtime surfaces only to the entities they render, preventing unrelated updates across thousands of entities from rerendering the dashboard.
- Add an IP-restricted direct add-on route whose server-side WebSocket and HTTP proxy authenticate to Home Assistant without exposing the Supervisor credential to the kiosk browser.

## 0.1.3

- Use the live Home Assistant frontend origin for Ingress authentication so secure-context proxies can reuse the frontend session without an origin mismatch or blocked OAuth redirect.

## 0.1.2

- Reuse the authenticated Home Assistant frontend session when Hearth runs through Ingress, avoiding an OAuth redirect that Home Assistant rejects inside the Ingress iframe.
- Keep standalone OAuth callbacks on the page that initiated authentication.

## 0.1.1

- Keep the Supervisor-only Home Assistant hostname on the server side and derive the browser-facing URL from trusted Ingress headers.
- Return OAuth callbacks to the exact Hearth page that initiated authentication, including Home Assistant Ingress paths.
- Support direct-port add-on access without exposing the internal Supervisor hostname to the browser.

## 0.1.0

- Add frosted glass surfaces: a backdrop blur knob for every card, tile and widget, a scrim over the background image and an inherited text shadow.
- Blur the edges where a scroll container cuts content off, on the page column, the editor sheet and the media shortcut row. Off-switch in Settings for slower screens.
- Float the theme editor over the dashboard as a draggable window so edits preview live against the real layout.
- Replace the browser's native colour input with an in-app picker: saturation square, hue strip, theme swatches and a hex field.
- Make the text ladder adjustable: contrast and shadow scales, plus muted-text and icon colours that no longer have to be derived from the ink.
- Keep the standard `backdrop-filter` in the built stylesheet. Writing the `-webkit-` prefix by hand made the minifier drop the unprefixed declaration, which current Chrome ignores, so every blur in the application was doing nothing.
- Add a Void (OLED) color theme preset with a true-black background.
- Establish Hearth as an independent dashboard with its own package, assets and Docker publishing target.
- Remove the retired dashboard, embedded objects, picture-elements tooling, alternate routes and cross-repository release automation.
- Replace camera playback and token login with Hearth components.
- Separate configuration definitions from rendering components so server and editor validation share the same schemas.
- Require revisioned configuration saves and reject unsupported persisted document formats.
- Establish semantic versioning from `0.1.0`.
