/**
 * Next.js Custom Server (HTTP only)
 * 
 * This server handles only HTTP requests for Next.js.
 * WebSocket connections are handled by the dedicated ws-server.ts on port 3001
 * 
 * Run with: npm run dev (runs both Next.js and WS server via concurrently)
 */

import { createServer, Server } from 'http';
import { parse, UrlWithParsedQuery } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server: Server = createServer(async (req, res) => {
    try {
      const parsedUrl: UrlWithParsedQuery = parse(req.url || '', true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  server.once('error', (err: Error) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`\n✅ Next.js server running on http://${hostname}:${port}`);
    console.log(`🔌 WebSocket server should be running separately on ws://localhost:3001\n`);
  });
});
