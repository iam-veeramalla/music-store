const express = require('express');

const app = express();
app.use(express.json());

const CATALOG = process.env.CATALOG_SERVICE_URL || 'http://localhost:8081';
const INVENTORY = process.env.INVENTORY_SERVICE_URL || 'http://localhost:8082';
const CART = process.env.CART_SERVICE_URL || 'http://localhost:8083';
const ORDER = process.env.ORDER_SERVICE_URL || 'http://localhost:8084';
const SHIPPING = process.env.SHIPPING_SERVICE_URL || 'http://localhost:8086';

async function forward(res, url, options = {}) {
  try {
    const upstream = await fetch(url, options);
    const body = await upstream.text();
    res.status(upstream.status)
      .type(upstream.headers.get('content-type') || 'application/json')
      .send(body);
  } catch (err) {
    console.error(`upstream failure for ${url}: ${err.message}`);
    res.status(502).json({ error: 'upstream unavailable', target: url });
  }
}

const jsonPost = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

app.get('/healthz', (req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// catalog
app.get('/api/products', (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  forward(res, `${CATALOG}/products${qs ? `?${qs}` : ''}`);
});
app.get('/api/products/:id', (req, res) => forward(res, `${CATALOG}/products/${req.params.id}`));
app.get('/api/categories', (req, res) => forward(res, `${CATALOG}/categories`));

// inventory
app.get('/api/stock', (req, res) => forward(res, `${INVENTORY}/stock`));
app.get('/api/stock/:id', (req, res) => forward(res, `${INVENTORY}/stock/${req.params.id}`));
app.post('/api/restock', (req, res) => forward(res, `${INVENTORY}/restock`, jsonPost(req.body)));

// cart
app.get('/api/cart/:sid', (req, res) => forward(res, `${CART}/cart/${req.params.sid}`));
app.post('/api/cart/:sid/items', (req, res) =>
  forward(res, `${CART}/cart/${req.params.sid}/items`, jsonPost(req.body)));
app.delete('/api/cart/:sid/items/:pid', (req, res) =>
  forward(res, `${CART}/cart/${req.params.sid}/items/${req.params.pid}`, { method: 'DELETE' }));
app.delete('/api/cart/:sid', (req, res) =>
  forward(res, `${CART}/cart/${req.params.sid}`, { method: 'DELETE' }));

// checkout: cart -> order -> clear cart
app.post('/api/checkout', async (req, res) => {
  const { sessionId, customerName, email, address } = req.body;
  if (!sessionId || !customerName || !email || !address) {
    return res.status(400).json({ error: 'sessionId, customerName, email, address required' });
  }
  try {
    const cartResp = await fetch(`${CART}/cart/${sessionId}`);
    const cart = await cartResp.json();
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'cart is empty' });
    }
    const orderResp = await fetch(`${ORDER}/orders`, jsonPost({
      sessionId, customerName, email, address, items: cart.items,
    }));
    const order = await orderResp.json();
    if (orderResp.status === 201) {
      await fetch(`${CART}/cart/${sessionId}`, { method: 'DELETE' });
    }
    res.status(orderResp.status).json(order);
  } catch (err) {
    console.error(`checkout failed: ${err.message}`);
    res.status(502).json({ error: 'checkout failed' });
  }
});

// orders + tracking
app.get('/api/orders/:id', (req, res) => forward(res, `${ORDER}/orders/${req.params.id}`));
app.get('/api/orders', (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  forward(res, `${ORDER}/orders${qs ? `?${qs}` : ''}`);
});
app.get('/api/tracking/:id', (req, res) => forward(res, `${SHIPPING}/tracking/${req.params.id}`));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`api-gateway listening on ${port}`));
