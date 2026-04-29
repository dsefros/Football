const http = require('http');
const { URL } = require('url');
const { buildApp } = require('./app');
const { PORT } = require('./config/env');
const { AppError, asErrorBody, httpStatusFromCode } = require('./domain/errors');

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk) => { buf += chunk; });
    req.on('end', () => {
      if (!buf) return resolve({});
      try { return resolve(JSON.parse(buf)); }
      catch (e) { return reject(new AppError('VALIDATION_ERROR', 'Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function createServer(appInstance = buildApp()) {
  const { router } = appInstance;

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const match = router.resolve(req.method, url.pathname);
    if (!match) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify(asErrorBody(new AppError('NOT_FOUND', 'Route not found'))));
      return;
    }

    try {
      const body = ['POST', 'PATCH'].includes(req.method) ? await parseJsonBody(req) : {};
      const query = Object.fromEntries(url.searchParams.entries());
      const result = await match.route.handler({ params: match.params, body, query });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      const appErr = err instanceof AppError ? err : new AppError('VALIDATION_ERROR', err.message || 'Unknown error');
      res.writeHead(httpStatusFromCode(appErr.code), { 'content-type': 'application/json' });
      res.end(JSON.stringify(asErrorBody(appErr)));
    }
  });
}

async function shutdownServer({ server, app, signal }) {
  console.log(`Received ${signal}, starting graceful shutdown...`);
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  app.close();
}

if (require.main === module) {
  const app = buildApp();
  const server = createServer(app);
  let isShuttingDown = false;

  const handleSignal = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    try {
      await shutdownServer({ server, app, signal });
      console.log('Graceful shutdown complete.');
      process.exit(0);
    } catch (error) {
      console.error('Graceful shutdown failed:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => { handleSignal('SIGINT'); });
  process.on('SIGTERM', () => { handleSignal('SIGTERM'); });

  server.listen(PORT, () => console.log(`Server running on :${PORT}`));
}

module.exports = { createServer, shutdownServer };
