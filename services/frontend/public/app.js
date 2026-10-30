/* Music Store SPA — talks to api-gateway via same-origin /api proxy */

const ICONS = {
  guitar: '🎸', keys: '🎹', drums: '🥁', tabla: '🪘', violin: '🎻',
  sitar: '🪕', flute: '🪈', sax: '🎷', mic: '🎤',
};
const icon = (name) => ICONS[name] || '🎵';
const money = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });

const sessionId = (() => {
  let sid = localStorage.getItem('sessionId');
  if (!sid) {
    sid = 'sess-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('sessionId', sid);
  }
  return sid;
})();

let stockMap = {};
let cart = { items: [] };

const view = document.getElementById('view');

async function api(path, options) {
  const resp = await fetch('/api' + path, options);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(data.error || data.detail || 'request failed'), { status: resp.status, data });
  return data;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- cart ---------- */

async function refreshCart() {
  try { cart = await api(`/cart/${sessionId}`); } catch { cart = { items: [] }; }
  document.getElementById('cart-count').textContent =
    cart.items.reduce((n, i) => n + i.quantity, 0);
  renderCartDrawer();
}

function renderCartDrawer() {
  const box = document.getElementById('cart-items');
  if (!cart.items.length) {
    box.innerHTML = '<div class="empty">Your cart is empty. Add an instrument to begin.</div>';
  } else {
    box.innerHTML = cart.items.map((i) => `
      <div class="ci">
        <div class="glyph">${icon(i.icon)}</div>
        <div><div>${i.name}</div><div class="muted">Qty ${i.quantity}</div></div>
        <span class="price">${money(i.priceCents * i.quantity)}</span>
        <button class="rm" title="Remove" onclick="removeItem(${i.productId})">✕</button>
      </div>`).join('');
  }
  document.getElementById('cart-total').textContent =
    money(cart.items.reduce((n, i) => n + i.priceCents * i.quantity, 0));
}

async function addToCart(p) {
  await api(`/cart/${sessionId}/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: p.id, name: p.name, priceCents: p.price_cents, quantity: 1, icon: p.icon }),
  });
  toast(`Added ${p.name}`);
  refreshCart();
}

async function removeItem(pid) {
  await api(`/cart/${sessionId}/items/${pid}`, { method: 'DELETE' });
  refreshCart();
}

function toggleCart() { document.body.classList.toggle('cart-open'); }

/* ---------- rendering ---------- */

function stockBadge(pid) {
  const qty = stockMap[pid];
  if (qty === undefined) return '';
  if (qty <= 0) return '<span class="badge out">Out of stock</span>';
  if (qty <= 3) return `<span class="badge low">Low · ${qty} left</span>`;
  return `<span class="badge in">In stock · ${qty}</span>`;
}

function productCard(p) {
  const qty = stockMap[p.id];
  return `
  <div class="card">
    <div class="img">${icon(p.icon)}</div>
    <div class="body">
      <div class="cat-tag">${p.category}</div>
      <h3>${p.name}</h3>
      <div class="sub">${p.subtitle || ''}</div>
      <div class="row">
        <span class="price">${money(p.price_cents)}</span>
        ${stockBadge(p.id)}
        <button class="add" ${qty === 0 ? 'disabled' : ''}
          onclick='addToCart(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Add</button>
      </div>
    </div>
  </div>`;
}

async function loadStock() {
  try {
    const rows = await api('/stock');
    stockMap = Object.fromEntries(rows.map((r) => [r.productId, r.quantity]));
  } catch { stockMap = {}; }
}

/* ---------- pages ---------- */

async function renderHome() {
  view.innerHTML = `
  <div class="hero"><div class="wrap">
    <div class="label">Handcrafted &amp; modern instruments</div>
    <h1>Find <i>your</i> sound.</h1>
    <p>Stage guitars to handcrafted sitars and tablas — instruments with lineage, from workshops around the world to your door.</p>
    <button class="cta" onclick="document.getElementById('featured').scrollIntoView({behavior:'smooth'})">Explore the collection</button>
    <button class="cta ghost" onclick="go('category','Studio')">Studio gear</button>
    <svg class="mandala" viewBox="0 0 200 200" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="100" cy="100" r="92" stroke-width="1"/><circle cx="100" cy="100" r="78" stroke-width=".7" stroke-dasharray="3 5"/>
      <circle cx="100" cy="100" r="58" stroke-width="1"/><circle cx="100" cy="100" r="30" stroke-width=".7"/>
      ${[0,45,90,135,180,225,270,315].map((d)=>`<path d="M100 8 q10 46 0 92 q-10 -46 0 -92" transform="rotate(${d} 100 100)" stroke-width=".8"/>`).join('')}
      <circle cx="100" cy="100" r="6" fill="currentColor"/>
    </svg>
  </div></div>
  <div class="wrap">
    <section>
      <div class="sec-head"><h2>Browse by section</h2><span id="cat-count"></span></div>
      <div class="orn">❖</div>
      <div class="cats" id="cats"></div>
    </section>
    <section id="featured">
      <div class="sec-head"><h2>Featured this week</h2><span>live stock from inventory-service</span></div>
      <div class="orn">❖</div>
      <div class="grid" id="products"></div>
    </section>
  </div>`;

  const [cats, products] = await Promise.all([api('/categories'), api('/products'), loadStock()]);
  const glyphs = { Guitars: '🎸', Keys: '🎹', Percussion: '🥁', Strings: '🎻', Winds: '🎷', Studio: '🎤' };
  document.getElementById('cat-count').textContent =
    `${cats.length} departments · ${products.length} instruments`;
  document.getElementById('cats').innerHTML = cats.map((c) => `
    <div class="cat" onclick="go('category','${c.category}')">
      <div class="glyph">${glyphs[c.category] || '🎵'}</div>
      <b>${c.category}</b><small>${c.items} items</small>
    </div>`).join('');
  document.getElementById('products').innerHTML = products.map(productCard).join('');
}

async function renderCategory(name) {
  view.innerHTML = `<div class="wrap"><section>
    <div class="sec-head"><h2>${name}</h2><span id="count"></span></div>
    <div class="orn">❖</div><div class="grid" id="products"></div></section></div>`;
  const [products] = await Promise.all([api(`/products?category=${encodeURIComponent(name)}`), loadStock()]);
  document.getElementById('count').textContent = `${products.length} items`;
  document.getElementById('products').innerHTML = products.map(productCard).join('');
}

async function renderSearch(q) {
  view.innerHTML = `<div class="wrap"><section>
    <div class="sec-head"><h2>Search: “${q}”</h2><span id="count"></span></div>
    <div class="orn">❖</div><div class="grid" id="products"></div></section></div>`;
  const [products] = await Promise.all([api(`/products?q=${encodeURIComponent(q)}`), loadStock()]);
  document.getElementById('count').textContent = `${products.length} matches`;
  document.getElementById('products').innerHTML =
    products.length ? products.map(productCard).join('') : '<div class="empty">No instruments matched.</div>';
}

function renderCheckout() {
  const total = cart.items.reduce((n, i) => n + i.priceCents * i.quantity, 0);
  view.innerHTML = `<div class="wrap"><section class="checkout">
    <h2>Checkout</h2>
    <div class="steps"><b>1 Details</b><span>›</span><span>2 Payment</span><span>›</span><span>3 Confirm</span></div>
    <input class="field" id="f-name" placeholder="Full name">
    <input class="field" id="f-email" placeholder="Email" type="email">
    <input class="field" id="f-address" placeholder="Shipping address">
    <button class="cta full" id="place" onclick="placeOrder()">Place order · ${money(total)}</button>
    <div id="result"></div>
  </section></div>`;
}

async function placeOrder() {
  const name = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const address = document.getElementById('f-address').value.trim();
  const result = document.getElementById('result');
  if (!name || !email || !address) {
    result.innerHTML = '<div class="err">Fill in name, email and address to place the order.</div>';
    return;
  }
  const btn = document.getElementById('place');
  btn.disabled = true; btn.textContent = 'Placing order…';
  try {
    const order = await api('/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, customerName: name, email, address }),
    });
    result.innerHTML = `<div class="ok"><b>✓ Order confirmed</b> — order <span class="mono">${order.orderId}</span>,
      tracking <span class="mono">${order.trackingId}</span>, payment <span class="mono">${order.transactionId}</span>.
      <br><br><button class="cta ghost" onclick="go('track','${order.trackingId}')">Track shipment</button></div>`;
    refreshCart();
  } catch (err) {
    result.innerHTML = `<div class="err">Order failed: ${err.message}. ${err.status === 402 ? 'The card was declined — try again.' : ''}</div>`;
    btn.disabled = false; btn.textContent = 'Place order';
  }
}

async function renderTrack(id) {
  view.innerHTML = `<div class="wrap"><section>
    <h2>Shipment tracking</h2><div class="track-box" id="track">Loading…</div></section></div>`;
  try {
    const t = await api(`/tracking/${id}`);
    document.getElementById('track').innerHTML =
      `Tracking <span class="mono">${t.trackingId}</span> · carrier <b>${t.carrier}</b><br>
       Status: <b>${t.status.replaceAll('_', ' ').toLowerCase()}</b> · ETA ${new Date(t.eta).toDateString()}<br>
       Destination: ${t.address}`;
  } catch {
    document.getElementById('track').innerHTML = 'Unknown tracking id.';
  }
}

/* ---------- router ---------- */

function go(page, arg) {
  window.scrollTo(0, 0);
  if (page === 'home') renderHome();
  else if (page === 'category') renderCategory(arg);
  else if (page === 'search') renderSearch(arg);
  else if (page === 'checkout') renderCheckout();
  else if (page === 'track') renderTrack(arg);
}

document.getElementById('search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) go('search', e.target.value.trim());
});

api('/categories').then((cats) => {
  document.getElementById('nav-links').innerHTML =
    cats.map((c) => `<a href="#" onclick="go('category','${c.category}');return false">${c.category}</a>`).join('');
}).catch(() => {});

renderHome();
refreshCart();
