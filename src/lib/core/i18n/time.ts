/** Anchored ISO timestamp check: YYYY-MM-DDTHH:MM:SS and parseable. */
export function isTimestamp(state: string): boolean {
	const format = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
	return format.test(state) && !isNaN(new Date(state).getTime());
}

/*
 * Intl formatters are expensive to build and the clock, scene tiles and
 * relative times format every second; build each distinct one once.
 */
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>();

/** A cached `Intl.DateTimeFormat`; `format` matches `toLocale*String` with the same options. */
export function dateTimeFormat(
	locale: string | undefined,
	options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
	const key = `${locale ?? ''}|${JSON.stringify(options)}`;
	let format = dateTimeFormats.get(key);
	if (!format) {
		format = new Intl.DateTimeFormat(locale, options);
		dateTimeFormats.set(key, format);
	}
	return format;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

/** A cached `Intl.NumberFormat`: tiles format brightness and percentages on every render. */
export function numberFormat(
	locale: string | undefined,
	options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
	const key = `${locale ?? ''}|${JSON.stringify(options)}`;
	let format = numberFormats.get(key);
	if (!format) {
		format = new Intl.NumberFormat(locale, options);
		numberFormats.set(key, format);
	}
	return format;
}

function relativeTimeFormat(locale: string | undefined): Intl.RelativeTimeFormat {
	const key = locale ?? '';
	let format = relativeTimeFormats.get(key);
	if (!format) {
		format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
		relativeTimeFormats.set(key, format);
	}
	return format;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['second', 60],
	['minute', 60],
	['hour', 24],
	['day', 30],
	['month', 12],
	['year', Infinity]
];

/** An ISO timestamp as "3 hours ago" in the given locale. */
export function relativeTime(timestamp: string, languageCode: string | undefined): string {
	const date = new Date(timestamp);
	if (isNaN(date.getTime())) {
		console.error(`Invalid timestamp: ${timestamp}`);
		return timestamp;
	}
	const formatter = relativeTimeFormat(languageCode);
	const diff = (date.getTime() - Date.now()) / 1000;
	let magnitude = Math.abs(diff);
	let index = 0;
	for (; index < UNITS.length - 1; index++) {
		if (magnitude < UNITS[index][1]) break;
		magnitude /= UNITS[index][1];
	}
	return formatter.format(Math.round(magnitude) * (diff < 0 ? -1 : 1), UNITS[index][0]);
}

/**
 * A date-only value (YYYY-MM-DD, how Home Assistant sends all-day calendar
 * events) as local midnight. `new Date` would read it as UTC midnight, which
 * is the previous evening west of Greenwich. Anything else parses as usual.
 */
export function parseLocalDate(value: string): Date {
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!dateOnly) return new Date(value);
	const [year, month, day] = [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])];
	// the constructor reads a two-digit year as 19xx; setFullYear does not
	const date = new Date(2000, 0, 1);
	date.setFullYear(year, month - 1, day);
	// the constructor rolls February 31 into March; that is not the date named
	const valid =
		date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
	return valid ? date : new Date(NaN);
}

/** The calendar date of `date` as YYYY-MM-DD in `timeZone`, or the browser zone. */
export function dateKey(date: Date, timeZone?: string): string {
	// en-CA formats as YYYY-MM-DD
	return dateTimeFormat('en-CA', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		...(timeZone ? { timeZone } : {})
	}).format(date);
}

/** Whole local calendar days from `from` to `to`; negative when `to` is earlier. */
export function calendarDaysBetween(from: Date, to: Date): number {
	const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
	const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
	// rounding absorbs the 23 and 25 hour days around a DST change
	return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}
