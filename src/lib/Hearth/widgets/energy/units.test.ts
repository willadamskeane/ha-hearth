import { describe, expect, it } from 'vitest';
import { kwhFactor } from './units';

describe('energy widget units', () => {
	it('scales energy units into kWh', () => {
		expect(kwhFactor('Wh')).toBe(0.001);
		expect(kwhFactor('wh')).toBe(0.001);
		expect(kwhFactor('MWh')).toBe(1000);
		expect(kwhFactor(' kWh ')).toBe(1);
	});

	it('passes through units it does not know', () => {
		expect(kwhFactor(undefined)).toBe(1);
		expect(kwhFactor('')).toBe(1);
		expect(kwhFactor('W')).toBe(1);
	});
});
