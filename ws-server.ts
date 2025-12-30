// /**
//  * Dedicated WebSocket Server for Secure Chat
//  * 
//  * Runs on port 3001 to handle WebSocket connections separately from Next.js
//  * Handles peer registration and message relaying
//  * 
//  * Start with: npm run ws:dev or npm run ws:start
//  */

// import { createServer, Server } from 'http';
// import { WebSocketServer, WebSocket } from 'ws';
// import crypto from 'crypto';

// const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);
// // const WS_HOST = process.env.WS_HOST || 'localhost';
// const WS_HOST = '0.0.0.0';

// // Store active WebSocket connections (peer_id -> WebSocket)
// const connections = new Map<string, WebSocket>();

// interface WebSocketMessage {
//   type: 'register' | 'message' | 'error' | 'registered' | 'request_identity' | 'identity_response';
//   peerId?: string;
//   from?: string;
//   to?: string;
//   timestamp?: number;
//   encryptedData?: string;
//   encryptedKey?: string;
//   rules?: {
//     readOnce?: boolean;
//     expiresAfterSeconds?: number;
//   };
//   message?: string;
// }

// // Create HTTP server (minimal, just for WebSocket upgrade)
// const server = createServer();

// // Create WebSocket server
// const wss = new WebSocketServer({
//   server,
//   perMessageDeflate: false,
//   clientTracking: true,
//   maxPayload: 64 * 1024, // [SECURITY] 64KB Max Message Size (DoS Protection)
//   // Security: Verify Origin to prevent CSWSH
//   verifyClient: (info, cb) => {
//     // In production, strictly check origin. In dev, allow localhost tools.
//     const origin = info.origin;
//     const allowedOrigins = [
//       'https://securechat-tau.vercel.app',
//       'http://localhost:3000'
//     ].filter(Boolean);

//     // Allow requests with no origin (like curl or local tools) ONLY in development
//     if (!origin && process.env.NODE_ENV !== 'production') {
//       return cb(true);
//     }

//     if (origin && allowedOrigins.includes(origin)) {
//       return cb(true);
//     }

//     // In development mode, be lenient if explicit variable isn't set, 
//     // but log it. For typical "npm run dev", origin is http://localhost:3000.
//     if (process.env.NODE_ENV !== 'production') {
//       // Check if it's coming from a local source
//       if (origin?.startsWith('http://localhost') || origin?.startsWith('http://127.0.0.1')) {
//         return cb(true);
//       }
//     }

//     console.log(`[WS] Blocked connection from unauthorized origin: ${origin}`);
//     return cb(false, 403, 'Forbidden');
//   }
// });

// // Rate Limiting Map (PeerID -> Timestamp[])
// const rateLimits = new Map<string, number[]>();

// // Cleanup rate limits interval
// setInterval(() => {
//   const now = Date.now();
//   for (const [id, times] of rateLimits.entries()) {
//     const valid = times.filter(t => now - t < 10000); // Keep messages from last 10 seconds
//     if (valid.length === 0) rateLimits.delete(id);
//     else rateLimits.set(id, valid);
//   }
// }, 30000); // Run every 30 seconds

// // Handle WebSocket connections
// wss.on('connection', (ws: WebSocket, req) => {
//   let peerId: string | null = null;
//   const clientIp = req.socket.remoteAddress || 'unknown';

//   // [SECURITY] Alive State for Idle Timeout
//   (ws as any).isAlive = true;
//   ws.on('pong', () => { (ws as any).isAlive = true; });

//   console.log(`[WS] New connection from ${clientIp}`);

//   // Set connection timeout (30 seconds to register)
//   const connectionTimeout = setTimeout(() => {
//     if (!peerId) {
//       console.log(`[WS] Connection timeout - no registration`);
//       ws.close(1008, 'Registration timeout');
//     }
//   }, 30000);

//   ws.on('message', (message: Buffer) => {
//     try {
//       const data: WebSocketMessage = JSON.parse(message.toString());

//       // Handle peer registration
//       if (data.type === 'register' && data.peerId) {
//         clearTimeout(connectionTimeout);
//         peerId = data.peerId;

//         // Remove old connection if peer reconnects
//         const existingWs = connections.get(peerId);
//         if (existingWs && existingWs.readyState === WebSocket.OPEN) {
//           console.log(`[WS] Closing existing connection for peer ${peerId.substring(0, 8)}...`);
//           existingWs.close(1000, 'Reconnected from another client');
//         }

//         connections.set(peerId, ws);
//         console.log(`[WS] Peer registered: ${peerId.substring(0, 8)}... (Total: ${connections.size})`);

//         ws.send(JSON.stringify({
//           type: 'registered',
//           peerId: peerId,
//         }));
//         return;
//       }

//       // Only allow registered peers to send messages
//       if (!peerId) {
//         ws.send(JSON.stringify({
//           type: 'error',
//           message: 'Not registered. Send register message first.',
//         }));
//         return;
//       }

//       // Security: Rate Limit Check
//       const now = Date.now();
//       const timestamps = rateLimits.get(peerId) || [];
//       const recent = timestamps.filter(t => now - t < 10000);

//       if (recent.length >= 50) {
//         console.warn(`[WS] Rate limit exceeded for ${peerId}`);
//         ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded (50 msgs/10s)' }));
//         return;
//       }
//       rateLimits.set(peerId, [...recent, now]);

//       // Handle message relay
//       const relayTypes = ['message', 'request_identity', 'identity_response'];
//       if (relayTypes.includes(data.type) && data.to) {
//         const targetWs = connections.get(data.to);

//         if (targetWs && targetWs.readyState === WebSocket.OPEN) {
//           // Relay message to target peer
//           const messageToSend: any = {
//             type: data.type, // Preserve generic type
//             from: data.from || peerId,
//             to: data.to,
//             timestamp: data.timestamp || Date.now(),
//             encryptedData: data.encryptedData,
//             encryptedKey: data.encryptedKey || '', // Legacy/Unused
//             rules: data.rules,
//           };

//           // Pass through handshake payloads
//           if (data.type === 'identity_response' && (data as any).publicKey) {
//             messageToSend.publicKey = (data as any).publicKey;
//           }

//           // Add Double Ratchet header/payloads if present
//           if ((data as any).header) messageToSend.header = (data as any).header;
//           if ((data as any).payload) messageToSend.payload = (data as any).payload; // For generic handshake

//           targetWs.send(JSON.stringify(messageToSend));

//           console.log(`[WS] Relayed ${data.type}: ${(data.from || peerId)?.substring(0, 8)}... → ${data.to.substring(0, 8)}...`);
//         } else {
//           // Target peer not connected
//           ws.send(JSON.stringify({
//             type: 'error',
//             message: 'Target peer not connected',
//           }));
//         }
//         return;
//       }

//       if (relayTypes.includes(data.type) && !data.to) {
//         ws.send(JSON.stringify({ type: 'error', message: 'Missing recipient (to) field' }));
//         return;
//       }

//       // Unknown message type
//       ws.send(JSON.stringify({
//         type: 'error',
//         message: 'Unknown message type',
//       }));

//     } catch (error) {
//       console.error('[WS] Error processing message:', error);
//       ws.send(JSON.stringify({
//         type: 'error',
//         message: 'Invalid message format',
//       }));
//     }
//   });

//   ws.on('close', (code: number, reason: Buffer) => {
//     if (peerId) {
//       connections.delete(peerId);
//       console.log(`[WS] Peer disconnected: ${peerId.substring(0, 8)}... (Code: ${code}, Total: ${connections.size})`);
//     } else {
//       console.log(`[WS] Unregistered connection closed (Code: ${code})`);
//     }
//     clearTimeout(connectionTimeout);
//   });

//   ws.on('error', (error: Error) => {
//     console.error('[WS] WebSocket error:', error);
//   });
// });

// // [SECURITY] Idle Timeout Check
// // Terminate connections that haven't responded to ping (dead peers or zombies)
// setInterval(() => {
//   wss.clients.forEach((ws) => {
//     // Check if connection is still alive
//     if ((ws as any).isAlive === false) {
//       console.log('[WS] Terminating idle/dead connection');
//       return ws.terminate();
//     }
//     // Mark as dead until pong is received
//     (ws as any).isAlive = false;
//     ws.ping();
//   });
// }, 30000);

// // Handle server errors
// server.on('error', (err: Error) => {
//   console.error('[WS] Server error:', err);
//   process.exit(1);
// });

// // Start server
// server.listen(WS_PORT, WS_HOST, () => {
//   console.log(`\n🚀 WebSocket Server running on ws://${WS_HOST}:${WS_PORT}`);
//   console.log(`📡 Ready to accept peer connections\n`);
// });

// // Graceful shutdown
// process.on('SIGTERM', () => {
//   console.log('\n[WS] SIGTERM received, closing server...');
//   wss.close(() => {
//     server.close(() => {
//       console.log('[WS] Server closed');
//       process.exit(0);
//     });
//   });
// });

// process.on('SIGINT', () => {
//   console.log('\n[WS] SIGINT received, closing server...');
//   wss.close(() => {
//     server.close(() => {
//       console.log('[WS] Server closed');
//       process.exit(0);
//     });
//   });
// });
