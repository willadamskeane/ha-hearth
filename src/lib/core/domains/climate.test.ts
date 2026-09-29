import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ha/commands', async (importOriginal) => ({
	...(await importOriginal<typeof import('../ha/commands')>()),
	service: vi.fn()
}));
import { service } from '../ha/commands';
import { CLIMATE_SETTLE_MS, setClimateTemperature } from './climate';

describe('climate temperature', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.mocked(service).mockClear();
	});
	afterEach(() => vi.useRealTimers());

	it('sends one call with the final target after taps pause', () => {
		setClimateTemperature('climate.hall', 73);
		vi.advanceTimersByTime(300);
		setClimateTemperature('climate.hall', 74);
		vi.advanceTimersByTime(300);
		setClimateTemperature('climate.hall', 75);
		expect(service).not.toHaveBeenCalled();
		vi.advanceTimersByTime(CLIMATE_SETTLE_MS);
		expect(service).toHaveBeenCalledTimes(1);
		expect(service).toHaveBeenCalledWith('climate', 'set_temperature', {
			entity_id: 'climate.hall',
			temperature: 75
		});
	});

	it('debounces each thermostat separately', () => {
		setClimateTemperature('climate.a', 70);
		setClimateTemperature('climate.b', 71);
		vi.advanceTimersByTime(CLIMATE_SETTLE_MS);
		expect(service).toHaveBeenCalledTimes(2);
	});
});
