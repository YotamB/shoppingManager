/**
 * shufersal/ui.js
 * Local web UI to review and edit predicted cart before ordering.
 * Run: node ui.js → open http://localhost:3737
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3737;
const DATA_DIR = path.join(__dirname, 'data');

const readJSON = (file) => {
  const p = path.join(DATA_DIR, file);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── API: get cart ──
  if (url.pathname === '/api/cart' && req.method === 'GET') {
    const cart = readJSON('predicted-cart.json') || [];
    const analysis = readJSON('analysis.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ cart, summary: analysis?.summary || {} }));
    return;
  }

  // ── API: save edited cart ──
  if (url.pathname === '/api/cart' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const cart = JSON.parse(body);
      fs.writeFileSync(path.join(DATA_DIR, 'predicted-cart.json'), JSON.stringify(cart, null, 2));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // ── API: trigger scrape + analyze ──
  if (url.pathname === '/api/refresh' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Refresh started in background. Check terminal.' }));
    setTimeout(() => {
      try {
        execSync(`node ${path.join(__dirname, 'scrape.js')} && node ${path.join(__dirname, 'analyze.js')}`, { stdio: 'inherit' });
      } catch(e) { console.error('Refresh error:', e.message); }
    }, 100);
    return;
  }

  // ── API: trigger order ──
  if (url.pathname === '/api/order' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Browser opening to add items to cart...' }));
    setTimeout(() => {
      try {
        execSync(`node ${path.join(__dirname, 'order.js')}`, { stdio: 'inherit' });
      } catch(e) { console.error('Order error:', e.message); }
    }, 100);
    return;
  }

  // ── Serve UI ──
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>🛒 Shufersal Auto-Order</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #222; }
  header { background: #e63b1e; color: white; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
  header h1 { font-size: 1.4rem; }
  .summary { display: flex; gap: 16px; padding: 16px 24px; flex-wrap: wrap; }
  .stat { background: white; border-radius: 8px; padding: 12px 20px; flex: 1; min-width: 140px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .stat .label { font-size: 0.75rem; color: #666; text-transform: uppercase; }
  .stat .value { font-size: 1.5rem; font-weight: bold; color: #e63b1e; }
  .actions { padding: 0 24px 16px; display: flex; gap: 10px; flex-wrap: wrap; }
  button { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; }
  .btn-primary { background: #e63b1e; color: white; }
  .btn-secondary { background: #444; color: white; }
  .btn-success { background: #28a745; color: white; }
  button:hover { opacity: 0.85; }
  .cart { padding: 0 24px 32px; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  th { background: #f0f0f0; padding: 10px 12px; text-align: right; font-size: 0.8rem; color: #555; }
  td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 0.9rem; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fafafa; }
  .conf-HIGH { color: #e63b1e; font-weight: bold; }
  .conf-MEDIUM { color: #f0a500; font-weight: bold; }
  input[type=number] { width: 60px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center; }
  .remove-btn { background: none; border: none; color: #aaa; cursor: pointer; font-size: 1rem; padding: 2px 6px; }
  .remove-btn:hover { color: #e63b1e; }
  .total-row td { font-weight: bold; background: #f9f9f9; }
  .status { padding: 8px 24px; font-size: 0.85rem; color: #555; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; }
  .badge-overdue { background: #ffe0de; color: #c0392b; }
  .badge-ok { background: #d4edda; color: #155724; }
</style>
</head>
<body>
<header>
  <h1>🛒 Shufersal Auto-Order</h1>
  <div id="last-updated" style="font-size:0.8rem;opacity:0.8"></div>
</header>

<div class="summary" id="summary"></div>

<div class="actions">
  <button class="btn-success" onclick="placeOrder()">🚀 הזמן עכשיו</button>
  <button class="btn-secondary" onclick="refresh()">🔄 רענן נתונים</button>
  <button class="btn-secondary" onclick="saveCart()">💾 שמור עריכות</button>
</div>

<div class="status" id="status"></div>

<div class="cart">
  <table id="cart-table">
    <thead>
      <tr>
        <th></th>
        <th>מוצר</th>
        <th>כמות</th>
        <th>מחיר יחידה</th>
        <th>סה"כ</th>
        <th>ביטחון</th>
        <th>ימים מאז קנייה</th>
        <th></th>
      </tr>
    </thead>
    <tbody id="cart-body"></tbody>
    <tfoot><tr class="total-row"><td colspan="4" style="text-align:left">סה"כ משוער</td><td id="cart-total"></td><td colspan="3"></td></tr></tfoot>
  </table>
</div>

<script>
let cart = [];
let summary = {};

async function load() {
  const r = await fetch('/api/cart');
  const data = await r.json();
  cart = data.cart;
  summary = data.summary;
  render();
}

function render() {
  // Summary
  const overdue = summary.daysOverdue > 0;
  document.getElementById('summary').innerHTML = \`
    <div class="stat"><div class="label">הזמנות שנותחו</div><div class="value">\${summary.totalOrders || '-'}</div></div>
    <div class="stat"><div class="label">ממוצע הזמנה</div><div class="value">₪\${summary.avgOrderValue || '-'}</div></div>
    <div class="stat"><div class="label">תדירות</div><div class="value">כל \${summary.avgOrderGapDays || '-'} ימים</div></div>
    <div class="stat"><div class="label">מצב</div><div class="value" style="font-size:1rem">\${overdue 
      ? '<span class="badge badge-overdue">⚠️ ' + summary.daysOverdue + ' ימים באיחור</span>'
      : '<span class="badge badge-ok">✅ בזמן</span>'
    }</div></div>
    <div class="stat"><div class="label">עגלה משוערת</div><div class="value">₪\${Math.round(cart.reduce((s,p)=>s+p.suggestedQty*p.avgUnitPrice,0))}</div></div>
  \`;

  // Cart table
  const tbody = document.getElementById('cart-body');
  tbody.innerHTML = cart.map((item, i) => \`
    <tr>
      <td><input type="checkbox" checked onchange="toggleItem(\${i}, this.checked)"></td>
      <td>\${item.name}</td>
      <td><input type="number" min="1" max="99" value="\${item.suggestedQty}" onchange="updateQty(\${i}, this.value)"></td>
      <td>₪\${item.avgUnitPrice}</td>
      <td>₪\${Math.round(item.suggestedQty * item.avgUnitPrice)}</td>
      <td class="conf-\${item.confidence}">\${item.confidence === 'HIGH' ? '🔴 גבוה' : '🟡 בינוני'}</td>
      <td>\${item.daysSinceLast}d</td>
      <td><button class="remove-btn" onclick="removeItem(\${i})">✕</button></td>
    </tr>
  \`).join('');

  // Total
  document.getElementById('cart-total').textContent = '₪' + Math.round(cart.reduce((s,p) => s + p.suggestedQty * p.avgUnitPrice, 0));
  document.getElementById('last-updated').textContent = summary.generatedAt ? 'עודכן: ' + new Date(summary.generatedAt).toLocaleString('he-IL') : '';
}

function updateQty(i, val) { cart[i].suggestedQty = parseInt(val) || 1; render(); }
function removeItem(i) { cart.splice(i, 1); render(); }
function toggleItem(i, checked) { if (!checked) removeItem(i); }

async function saveCart() {
  await fetch('/api/cart', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(cart) });
  setStatus('✅ עגלה נשמרה');
}

async function refresh() {
  setStatus('🔄 מרענן נתונים... (יכול לקחת כמה דקות)');
  await fetch('/api/refresh', { method: 'POST' });
  setTimeout(load, 3000);
}

async function placeOrder() {
  await saveCart();
  setStatus('🚀 פותח דפדפן להוספת מוצרים לסל...');
  await fetch('/api/order', { method: 'POST' });
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
  setTimeout(() => document.getElementById('status').textContent = '', 5000);
}

load();
</script>
</body>
</html>`;

server.listen(PORT, () => {
  console.log(`🛒 Shufersal UI running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
  // Auto-open browser
  try { execSync(`open http://localhost:${PORT}`); } catch(e) {}
});
