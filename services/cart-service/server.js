const express = require('express');
const { createClient } = require('redis');

const app = express();
app.use(express.json());

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', (err) => console.error('redis error', err.message));

const key = (sessionId) => `cart:${sessionId}`;

async function getCart(sessionId) {
  const raw = await redis.get(key(sessionId));
  return raw ? JSON.parse(raw) : { sessionId, items: [] };
}

async function saveCart(cart) {
  await redis.set(key(cart.sessionId), JSON.stringify(cart), { EX: 60 * 60 * 24 });
}

app.get('/healthz', (req, res) => res.json({ status: 'ok', service: 'cart-service' }));

app.get('/cart/:sessionId', async (req, res) => {
  res.json(await getCart(req.params.sessionId));
});

app.post('/cart/:sessionId/items', async (req, res) => {
  const { productId, name, priceCents, quantity = 1 } = req.body;
  if (!productId || !name) return res.status(400).json({ error: 'productId and name required' });
  const cart = await getCart(req.params.sessionId);
  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) existing.quantity += quantity;
  else cart.items.push({ productId, name, priceCents, quantity });
  await saveCart(cart);
  res.status(201).json(cart);
});

app.delete('/cart/:sessionId/items/:productId', async (req, res) => {
  const cart = await getCart(req.params.sessionId);
  cart.items = cart.items.filter((i) => String(i.productId) !== req.params.productId);
  await saveCart(cart);
  res.json(cart);
});

app.delete('/cart/:sessionId', async (req, res) => {
  await redis.del(key(req.params.sessionId));
  res.json({ sessionId: req.params.sessionId, items: [] });
});

const port = process.env.PORT || 8083;
redis.connect().then(() => {
  app.listen(port, () => console.log(`cart-service listening on ${port}`));
});
