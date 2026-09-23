import { expect, test } from '@playwright/test';

/* The state subscription covers only what the dashboard shows, and widens to
   every entity while the editor needs the whole house. */

test('the entity subscription narrows to the dashboard and widens while editing', async ({
	page
}) => {
	const subscriptions: (number | 'all')[] = [];
	page.on('websocket', (socket) =>
		socket.on('framesent', (frame) => {
			const message = JSON.parse(String(frame.payload));
			if (message.type === 'subscribe_entities')
				subscriptions.push(message.entity_ids ? message.entity_ids.length : 'all');
		})
	);

	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await expect.poll(() => subscriptions.length).toBeGreaterThanOrEqual(2);
	expect(subscriptions[0]).toBe('all');
	const scoped = subscriptions[1];
	expect(typeof scoped).toBe('number');
	// the fixture house has far more entities than the one page shows
	expect(scoped).toBeLessThan(20);
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();

	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await expect.poll(() => subscriptions.at(-1)).toBe('all');

	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect.poll(() => subscriptions.at(-1)).toBe(scoped);
});
