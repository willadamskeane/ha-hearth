import { beforeEach, describe, expect, it, vi } from 'vitest';

const created: { destroy: ReturnType<typeof vi.fn>; option: ReturnType<typeof vi.fn> }[] = [];
vi.mock('sortablejs', () => ({
	default: {
		create: vi.fn(() => {
			const instance = { destroy: vi.fn(), option: vi.fn() };
			created.push(instance);
			return instance;
		})
	}
}));

const { sortable } = await import('./sortable');

const options = (disabled: boolean) => ({
	group: 'cards',
	disabled,
	items: [],
	onFinalize: () => {}
});

describe('sortable', () => {
	beforeEach(() => {
		created.length = 0;
	});

	it('does not set SortableJS up while dragging is disabled', () => {
		const action = sortable(document.createElement('div'), options(true));
		expect(created).toHaveLength(0);
		action.destroy?.();
	});

	it('creates the instance when dragging is enabled and drops it when disabled again', () => {
		const action = sortable(document.createElement('div'), options(true));
		action.update?.(options(false));
		expect(created).toHaveLength(1);
		action.update?.(options(false));
		expect(created).toHaveLength(1);
		action.update?.(options(true));
		expect(created[0].destroy).toHaveBeenCalledOnce();
		action.destroy?.();
		expect(created[0].destroy).toHaveBeenCalledOnce();
	});

	it('an enabled zone is set up immediately and destroyed with the node', () => {
		const action = sortable(document.createElement('div'), options(false));
		expect(created).toHaveLength(1);
		action.destroy?.();
		expect(created[0].destroy).toHaveBeenCalledOnce();
	});
});
