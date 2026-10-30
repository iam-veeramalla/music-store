// Synthetic shopper: browses, searches, fills carts, checks out.
// Keeps Dash0 dashboards alive without manual clicking.

const GATEWAY = process.env.API_GATEWAY_URL || 'http://localhost:3000';
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 3000);

const NAMES = ['Jordan Reyes', 'Priya Sharma', 'Liam Chen', 'Sofia Rossi', 'Amara Okafor'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function api(path, options) {
  const resp = await fetch(`${GATEWAY}/api${path}`, options);
  return { status: resp.status, body: await resp.json().catch(() => ({})) };
}

async function session() {
  const sid = 'load-' + Math.random().toString(36).slice(2, 10);
  const { body: products } = await api('/products');
  if (!Array.isArray(products) || !products.length) return;

  await api('/categories');
  // occasionally restock a random product so the store never fully sells out
  if (Math.random() < 0.15) {
    const p = pick(products);
    await api(`/restock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: p.id, quantity: 5 }),
    });
  }
  await api(`/products/${pick(products).id}`);
  await api('/stock');
  if (Math.random() < 0.3) await api(`/products?q=${pick(['guitar', 'tabla', 'piano', 'mic', 'flute'])}`);

  // ~70% of sessions buy something
  if (Math.random() < 0.7) {
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const p = pick(products);
      await api(`/cart/${sid}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: p.id, name: p.name, priceCents: p.price_cents, quantity: 1, icon: p.icon }),
      });
    }
    const name = pick(NAMES);
    const { status, body } = await api('/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: sid,
        customerName: name,
        email: name.toLowerCase().replace(' ', '.') + '@example.com',
        address: '221 Baker Street, London NW1',
      }),
    });
    if (status === 201) {
      console.log(`order placed: ${body.orderId}`);
      if (Math.random() < 0.5) await api(`/tracking/${body.trackingId}`);
    } else {
      console.log(`checkout ended with ${status}: ${body.error || body.detail || ''}`);
    }
  }
}

(async () => {
  console.log(`load-generator targeting ${GATEWAY}, interval ${INTERVAL_MS}ms`);
  for (;;) {
    try { await session(); } catch (err) { console.error('session failed:', err.message); }
    await sleep(INTERVAL_MS + Math.random() * INTERVAL_MS);
  }
})();
