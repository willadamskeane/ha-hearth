import { handler } from './build/handler.js';
import express from 'express';
import { createServer } from 'node:http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import WebSocket, { WebSocketServer } from 'ws';
import { resolvePublicHassUrl } from './server-url.js';
import {
	isTrustedDirectRequest,
	parseTrustedClients,
	supervisorAuthMessage,
	supervisorWebsocketTarget
} from './server-auth.js';

dotenv.config({ quiet: true });
const proxyTarget = process.env.HASS_URL;
if (!proxyTarget) throw new Error('HASS_URL is required');
const supervisorTarget = process.env.SUPERVISOR_URL || 'http://supervisor';
const addon = process.env.ADDON === 'true';
const directAccess = process.env.HEARTH_DIRECT_ACCESS === 'true';
const directLowPower = process.env.HEARTH_LOW_POWER === 'true';
const trustedClients = parseTrustedClients(process.env.HEARTH_TRUSTED_CLIENTS);
const supervisorToken = process.env.SUPERVISOR_TOKEN;
const port = Number(process.env.PORT || 5050);
const app = express();
app.use((request, _response, next) => {
	// Never accept private hand-off headers from a client. Only this server may
	// tell SvelteKit which connection mode is safe for the request.
	delete request.headers['x-hearth-hass-url'];
	delete request.headers['x-hearth-server-auth'];
	delete request.headers['x-hearth-low-power'];
	const trustedDirect = isTrustedDirectRequest(request, directAccess, trustedClients);
	request.hearthTrustedDirect = trustedDirect;
	if (trustedDirect) {
		request.headers['x-hearth-server-auth'] = '1';
		if (directLowPower) request.headers['x-hearth-low-power'] = '1';
	}
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
		pathFilter: (path, request) => Boolean(request.hearthTrustedDirect && path.startsWith('/api/')),
		target: supervisorTarget,
		changeOrigin: true,
		pathRewrite: (path) => `/core${path}`,
		on: {
			proxyReq(proxyRequest) {
				if (supervisorToken) {
					proxyRequest.setHeader('Authorization', `Bearer ${supervisorToken}`);
				}
			}
		}
	})
);
app.use(
	createProxyMiddleware({
		pathFilter: ['/local/', '/api/'],
		target: proxyTarget,
		changeOrigin: true
	})
);
app.use(handler);

const server = createServer(app);
const websocketServer = new WebSocketServer({ noServer: true });

websocketServer.on('connection', (browserSocket) => {
	if (!supervisorToken) {
		browserSocket.close(1011, 'Server authentication is unavailable');
		return;
	}

	const homeAssistantSocket = new WebSocket(supervisorWebsocketTarget(supervisorTarget));
	const closeBoth = () => {
		if (browserSocket.readyState === WebSocket.OPEN) browserSocket.close();
		if (homeAssistantSocket.readyState === WebSocket.CONNECTING) homeAssistantSocket.terminate();
		else if (homeAssistantSocket.readyState === WebSocket.OPEN) homeAssistantSocket.close();
	};

	homeAssistantSocket.on('message', (data, isBinary) => {
		if (browserSocket.readyState === WebSocket.OPEN) browserSocket.send(data, { binary: isBinary });
	});
	browserSocket.on('message', (data, isBinary) => {
		if (homeAssistantSocket.readyState !== WebSocket.OPEN) return;
		const authenticated = !isBinary ? supervisorAuthMessage(data, supervisorToken) : undefined;
		homeAssistantSocket.send(authenticated ?? data, { binary: authenticated ? false : isBinary });
	});
	homeAssistantSocket.on('close', closeBoth);
	browserSocket.on('close', closeBoth);
	homeAssistantSocket.on('error', closeBoth);
	browserSocket.on('error', closeBoth);
});

server.on('upgrade', (request, socket, head) => {
	let pathname;
	try {
		pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
	} catch {
		socket.destroy();
		return;
	}
	if (
		pathname !== '/api/websocket' ||
		!isTrustedDirectRequest(request, directAccess, trustedClients)
	) {
		socket.destroy();
		return;
	}
	websocketServer.handleUpgrade(request, socket, head, (websocket) => {
		websocketServer.emit('connection', websocket, request);
	});
});

server.listen(port, () => console.log(`Hearth listening on port ${port}`));
