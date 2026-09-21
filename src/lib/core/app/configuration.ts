import { writable } from 'svelte/store';
import * as v from 'valibot';

/* App-wide settings from data/configuration.yaml, for Hearth. */

export type SliderUpdateMode = 'continuous' | 'release';
export type PerformanceMode = 'auto' | 'full' | 'low';

export const ConfigurationSchema = v.object({
	locale: v.optional(v.pipe(v.string(), v.regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i))),
	custom_js: v.optional(v.boolean()),
	motion: v.optional(v.boolean()),
	haptics: v.optional(v.boolean()),
	performance_mode: v.optional(v.picklist(['auto', 'full', 'low'])),
	token: v.optional(v.string()),
	revision: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)))
});

export type Configuration = v.InferOutput<typeof ConfigurationSchema> & {
	hassUrl?: string;
	/** The add-on authenticates the same-origin WebSocket without exposing its token. */
	serverAuth?: boolean;
	/** A trusted direct-port request may force the low-power renderer. */
	serverLowPower?: boolean;
};

export interface PersistentNotification {
	created_at: string;
	message: string;
	notification_id: string;
	title: string;
	status: 'read' | 'unread';
}

export const configuration = writable<Configuration>();
