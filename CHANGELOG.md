# Changelog

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
