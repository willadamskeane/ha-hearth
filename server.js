import { handler } from './build/handler.js';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import { resolvePublicHassUrl } from './server-url.js';

dotenv.config({ quiet: true });
const proxyTarget = process.env.HASS_URL;
if (!proxyTarget) throw new Error('HASS_URL is required');
const addon = process.env.ADDON === 'true';
const port = Number(process.env.PORT || 5050);
const app = express();
app.use((request, _response, next) => {
	// Never accept this private hand-off header from a client. Only this server
	// may tell SvelteKit which Home Assistant origin is safe to expose.
	delete request.headers['x-hearth-hass-url'];
	const publicHassUrl = resolvePublicHassUrl(request.headers, {
		addon,
		hassUrl: proxyTarget,
		publicHassUrl: process.env.PUBLIC_HASS_URL,
		hassPort: process.env.HASS_PORT,
		exposedPort: process.env.EXPOSED_PORT,
		secure: request.secure
	});
	if (publicHassUrl) request.headers['x-hearth-hass-url'] = publicHassUrl;
	next();
});
app.use(
	createProxyMiddleware({
		pathFilter: ['/local/', '/api/'],
		target: proxyTarget,
		changeOrigin: true
	})
);
app.use(handler);
app.listen(port, () => console.log(`Hearth listening on port ${port}`));
