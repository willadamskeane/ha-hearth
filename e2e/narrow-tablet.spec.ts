import { expect, test } from '@playwright/test';

/* A wall tablet between the phone and rail breakpoints: the rail folds into
   the page strip, so the edit toggle must live there instead of floating over
   the first column. */

test.use({ viewport: { width: 853, height: 533 }, hasTouch: true });

test('the edit toggle sits in the page strip, not over page content', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();

	const strip = page.getByRole('navigation', { name: 'Pages' });
	const toggles = page.getByRole('button', { name: 'Edit Hearth configuration' });
	await expect(toggles).toHaveCount(1);
	await expect(strip.getByRole('button', { name: 'Edit Hearth configuration' })).toBeInViewport();

	await toggles.click();
	await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
	await expect(toggles).toHaveCount(0);
});

test('?menu=false hides the strip toggle too', async ({ page }) => {
	await page.goto('/?menu=false');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Edit Hearth configuration' })).toHaveCount(0);
});

test('the room header drops to a compact size', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	const header = page.locator('.header-slot');
	await expect(header.locator('.name')).toHaveCSS('font-size', '20px');
	const box = (await header.boundingBox())!;
	expect(box.height).toBeLessThanOrEqual(48);
});

test('the rail clock moves into a status strip above the page', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	const strip = page.getByRole('group', { name: 'Status' });
	await expect(strip).toBeInViewport();
	await expect(strip.locator('.compact-time')).toHaveText(/\d/);
	// the rail held only the clock and nav, so nothing is left to fold below the page
	await expect(page.locator('.rail-scroll')).toBeHidden();
	const stripBox = (await strip.boundingBox())!;
	const navBox = (await page.getByRole('navigation', { name: 'Pages' }).boundingBox())!;
	expect(stripBox.y).toBeLessThan(navBox.y);
});

test('wide screens keep the rail and no strip', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await expect(page.getByRole('group', { name: 'Status' })).toBeHidden();
	await expect(page.locator('.rail .clock')).toBeVisible();
});
