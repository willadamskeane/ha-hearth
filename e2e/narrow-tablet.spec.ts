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
