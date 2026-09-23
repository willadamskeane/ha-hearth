import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { calendarWidget as definition, type CalendarWidget } from '../../model/widgets/calendar';
export type { CalendarWidget } from '../../model/widgets/calendar';

export const calendarWidget: WidgetDescriptor<CalendarWidget> = {
	...definition,
	component: Widget,
	strip: true,
	editor: () => import('./Editor.svelte')
};
