const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

const GATEWAY = process.env.API_GATEWAY_URL || 'http://localhost:3000';

app.get('/healthz', (req, res) => res.json({ status: 'ok', service: 'frontend' }));

// proxy /api/* to the gateway so the browser needs no CORS setup
app.use('/api', async (req, res) => {
  const url = `${GATEWAY}/api${req.url}`;
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: { 'content-type': 'application/json' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const body = await upstream.text();
    res.status(upstream.status)
      .type(upstream.headers.get('content-type') || 'application/json')
      .send(body);
  } catch (err) {
    console.error(`gateway unreachable: ${err.message}`);
    res.status(502).json({ error: 'gateway unavailable' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`frontend listening on ${port}`));
