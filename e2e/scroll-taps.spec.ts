import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/* Taps that belong to a scroll must not toggle lights: a touch that begins
   while the page is scrolling, or a press that drifts vertically, is not a tap.
   A mouse click after a wheel scroll is deliberate and still works. */

const FAKE_HASS = 'http://127.0.0.1:8124';

test.use({ viewport: { width: 1000, height: 420 }, hasTouch: true });

async function lightCalls(request: APIRequestContext) {
	const calls: { domain: string }[] = await (await request.get(`${FAKE_HASS}/_test/calls`)).json();
	return calls.filter((call) => call.domain === 'light');
}

/** The element the dashboard scrolls in, scrolled a little so it can scroll back. */
async function scrollPage(page: Page, deltaY: number) {
	const tile = page.getByRole('button', { name: /Desk lamp/ });
	const box = await tile.boundingBox();
	if (!box) throw new Error('tile has no box');
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, deltaY);
}

test.beforeEach(async ({ page, request }) => {
	await request.post(`${FAKE_HASS}/_test/reset`);
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
});

test('the page scrolls at this size', async ({ page }) => {
	const scrolled = page.evaluate(
		() =>
			new Promise<boolean>((resolve) => {
				addEventListener('scroll', () => resolve(true), { capture: true, once: true });
				setTimeout(() => resolve(false), 1500);
			})
	);
	await scrollPage(page, 120);
	expect(await scrolled).toBe(true);
});

async function touchTile(page: Page) {
	const box = await page.getByRole('button', { name: /Desk lamp/ }).boundingBox();
	if (!box) throw new Error('tile has no box');
	await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('a touch right after a scroll does nothing; one after the page settles toggles', async ({
	page,
	request
}) => {
	await scrollPage(page, 120);
	await scrollPage(page, -120);
	await touchTile(page);
	await page.waitForTimeout(400);
	expect(await lightCalls(request)).toEqual([]);

	await touchTile(page);
	await expect.poll(() => lightCalls(request)).toHaveLength(1);
});

test('a mouse click right after a wheel scroll still toggles', async ({ page, request }) => {
	await scrollPage(page, 120);
	await scrollPage(page, -120);
	await page.getByRole('button', { name: /Desk lamp/ }).click();
	await expect.poll(() => lightCalls(request)).toHaveLength(1);
});

test('a press that drifts vertically is not a tap', async ({ page, request }) => {
	const tile = page.getByRole('button', { name: /Desk lamp/ });
	const box = await tile.boundingBox();
	if (!box) throw new Error('tile has no box');
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + 2, y + 18, { steps: 4 });
	await page.mouse.up();
	await page.waitForTimeout(400);
	expect(await lightCalls(request)).toEqual([]);
});

test('keyboard activation still toggles right after a scroll', async ({ page, request }) => {
	const tile = page.getByRole('button', { name: /Desk lamp/ });
	await tile.focus();
	await scrollPage(page, 120);
	await page.keyboard.press('Enter');
	await expect.poll(() => lightCalls(request)).toHaveLength(1);
});
