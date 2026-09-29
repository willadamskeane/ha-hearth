import { markPending, service, setControlOverride } from '../ha/commands';

// Cloud thermostats (Nest) rate limit, so taps on +/- only move the optimistic
// value; one call with the final target goes out once taps have paused.
export const CLIMATE_SETTLE_MS = 1500;
const pendingTemperature: Record<string, ReturnType<typeof setTimeout>> = {};

export function setClimateTemperature(entity: string, temperature: number) {
	setControlOverride(`climate:${entity}`, temperature, CLIMATE_SETTLE_MS + 5000);
	clearTimeout(pendingTemperature[entity]);
	pendingTemperature[entity] = setTimeout(() => {
		delete pendingTemperature[entity];
		markPending(entity);
		service('climate', 'set_temperature', { entity_id: entity, temperature });
	}, CLIMATE_SETTLE_MS);
}

export function setClimateHvacMode(entity: string, mode: string) {
	markPending(entity);
	service('climate', 'set_hvac_mode', { entity_id: entity, hvac_mode: mode });
}
