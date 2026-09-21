import { describe, expect, it } from 'vitest';
import { resolveLowPower } from './performance';

describe('resolveLowPower', () => {
	it('selects low power automatically for old Android kiosks', () => {
		expect(resolveLowPower({}, { userAgent: 'Mozilla/5.0 (Linux; Android 8.1.0)' })).toBe(true);
	});

	it('allows explicit full and low overrides', () => {
		expect(resolveLowPower({ performance_mode: 'full' }, { userAgent: 'Android 8.1.0' })).toBe(
			false
		);
		expect(resolveLowPower({ performance_mode: 'low' }, { userAgent: 'Desktop' })).toBe(true);
	});

	it('honors the trusted direct-port hint in automatic mode', () => {
		expect(resolveLowPower({ serverLowPower: true }, { userAgent: 'Desktop' })).toBe(true);
	});
});
