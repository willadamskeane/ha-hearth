/*
 * Recorder statistics carry the entity's own unit, so an energy sensor
 * measured in Wh sums to a Wh total while the widget labels its reading in
 * kWh. Scale the sum into kWh instead of relabelling the raw number;
 * an unset or unrecognised unit passes through unchanged.
 */

export function kwhFactor(unit: string | undefined): number {
	switch (unit?.trim().toLowerCase()) {
		case 'wh':
			return 0.001;
		case 'mwh':
			return 1000;
		default:
			return 1;
	}
}
