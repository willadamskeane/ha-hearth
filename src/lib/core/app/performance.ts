import { writable } from 'svelte/store';
import type { Configuration, PerformanceMode } from './configuration';

/** True when Hearth should avoid paint-heavy effects and nonessential motion. */
export const lowPower = writable(false);

function oldAndroid(userAgent: string): boolean {
	const match = /Android\s+(\d+)/i.exec(userAgent);
	return match !== null && Number(match[1]) <= 9;
}

export function resolveLowPower(
	configuration: Configuration | undefined,
	navigatorLike: Pick<Navigator, 'userAgent'> | undefined
): boolean {
	const mode: PerformanceMode = configuration?.performance_mode ?? 'auto';
	if (mode === 'low') return true;
	if (mode === 'full') return false;
	return configuration?.serverLowPower === true || oldAndroid(navigatorLike?.userAgent ?? '');
}

export function applyPerformanceMode(enabled: boolean): void {
	lowPower.set(enabled);
	if (typeof document !== 'undefined')
		document.documentElement.classList.toggle('low-power', enabled);
}
