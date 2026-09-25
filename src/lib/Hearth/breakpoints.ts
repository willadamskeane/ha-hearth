/*
 * The one width where the dashboard changes shape. At or below it the rail
 * folds out of its column and into the page flow, the page switcher appears,
 * and every overlay (control popups, edit sheets) becomes a full-width sheet
 * instead of a centred window.
 *
 * CSS cannot read a custom property inside a media query, so the stylesheets
 * repeat the number as a literal. Every one of those is marked
 * `see breakpoints.ts` - change them together.
 */
export const FOLD_WIDTH = 900;

/** Matches while the rail is folded under the page. */
export const FOLD_QUERY = `(max-width: ${FOLD_WIDTH}px)`;

/** Matches while the rail still has its own column. */
export const WIDE_QUERY = `(min-width: ${FOLD_WIDTH + 1}px)`;

/**
 * A folded layout with almost no height to give: a phone held sideways. The
 * page switcher drops its labels there rather than eating a sixth of the
 * screen. The tallest phones are about 430 px high sideways; a small wall
 * tablet is not much taller (the 1280x800 ThinkSmart View is 788x492 in CSS
 * px), so the cutoff sits between them. PhoneNav.svelte repeats it in CSS.
 */
export const SHORT_QUERY = '(max-height: 440px) and (orientation: landscape)';
