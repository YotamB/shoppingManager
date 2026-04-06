const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3100;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Data paths ──────────────────────────────────────────────────────────────
const DATA_PATHS = {
  fullReport: '/tmp/shufersal-full-report.json',
  analysis: '/tmp/shufersal-analysis.json',
  predictedCart: '/tmp/shufersal-predicted-cart.json',
};

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Failed to read ${filePath}:`, e.message);
    return null;
  }
}

// ── Shufersal API ────────────────────────────────────────────────────────────
app.get('/api/shufersal/summary', (req, res) => {
  const report = readJSON(DATA_PATHS.fullReport);
  if (!report) return res.status(500).json({ error: 'Could not read report data' });
  res.json(report.summary);
});

app.get('/api/shufersal/staples', (req, res) => {
  const report = readJSON(DATA_PATHS.fullReport);
  if (!report) return res.status(500).json({ error: 'Could not read report data' });
  res.json(report.staples || []);
});

app.get('/api/shufersal/predicted', (req, res) => {
  const report = readJSON(DATA_PATHS.fullReport);
  if (!report) return res.status(500).json({ error: 'Could not read report data' });
  res.json(report.predictedNextOrder || []);
});

app.get('/api/shufersal/analysis', (req, res) => {
  const analysis = readJSON(DATA_PATHS.analysis);
  if (!analysis) return res.status(500).json({ error: 'Could not read analysis data' });
  res.json(analysis);
});

app.get('/api/shufersal/cart', (req, res) => {
  const cart = readJSON(DATA_PATHS.predictedCart);
  if (!cart) return res.status(500).json({ error: 'Could not read cart data' });
  res.json(cart);
});

// Build cart endpoint – placeholder for future Shufersal automation
app.post('/api/shufersal/build-cart', (req, res) => {
  const cart = readJSON(DATA_PATHS.predictedCart);
  const predicted = readJSON(DATA_PATHS.fullReport)?.predictedNextOrder || [];

  // Merge predicted + cart data
  const items = predicted.map(item => ({
    name: item.name,
    qty: Math.ceil(item.suggestedQty),
    confidence: item.confidence,
    estPrice: item.avgPrice,
    estTotal: +(Math.ceil(item.suggestedQty) * item.avgPrice).toFixed(2),
  }));

  const totalEst = items.reduce((sum, i) => sum + (i.estTotal || 0), 0);

  console.log(`[${new Date().toISOString()}] Build cart requested — ${items.length} items, est. ₪${totalEst.toFixed(2)}`);

  res.json({
    success: true,
    message: 'Cart prepared (manual ordering required)',
    itemCount: items.length,
    estimatedTotal: +totalEst.toFixed(2),
    items,
  });
});

// ── Leket API ───────────────────────────────────────────────────────────────
const LEKET_DATA = path.join(__dirname, '..', 'leket');

function readLeket(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(LEKET_DATA, filename), 'utf8'));
  } catch (e) { return null; }
}

app.get('/api/leket/summary', (req, res) => {
  const parsed = readLeket('parsed_orders.json');
  const catalog = readLeket('catalog_latest.json');
  if (!parsed) return res.status(500).json({ error: 'No leket data' });

  const orders = parsed.orders || [];
  const items = parsed.item_summary || [];
  const totalSpend = orders.reduce((sum, o) => {
    return sum + (o.items || []).reduce((s, i) => {
      const p = parseFloat((i.total || '').replace(/[^\d.]/g, '')) || 0;
      return s + p;
    }, 0);
  }, 0);

  const dates = orders.map(o => o.date).filter(Boolean).sort();
  res.json({
    totalOrders: orders.length,
    uniqueItems: items.length,
    dateRange: { from: dates[0] || null, to: dates[dates.length-1] || null },
    catalogItems: catalog ? catalog.totalItems : null,
    catalogScannedAt: catalog ? catalog.scannedAt : null,
  });
});

app.get('/api/leket/top-items', (req, res) => {
  const parsed = readLeket('parsed_orders.json');
  if (!parsed) return res.status(500).json({ error: 'No leket data' });
  res.json((parsed.item_summary || []).slice(0, 50));
});

app.get('/api/leket/seasonal', (req, res) => {
  const parsed = readLeket('parsed_orders.json');
  if (!parsed) return res.status(500).json({ error: 'No leket data' });

  // Build month→items map
  const monthMap = {}; // { 'YYYY-MM': { itemName: totalQty } }
  for (const order of parsed.orders || []) {
    if (!order.date) continue;
    // date format: DD/MM/YY HH:MM
    const parts = order.date.split('/');
    if (parts.length < 2) continue;
    const month = `20${parts[2].slice(0,2)}-${parts[1].padStart(2,'0')}`;
    if (!monthMap[month]) monthMap[month] = {};
    for (const item of order.items || []) {
      monthMap[month][item.name] = (monthMap[month][item.name] || 0) + item.qty;
    }
  }

  // Find items with seasonal pattern (appear in some months but not others)
  const itemMonths = {}; // itemName → { month: qty }
  for (const [month, items] of Object.entries(monthMap)) {
    for (const [name, qty] of Object.entries(items)) {
      if (!itemMonths[name]) itemMonths[name] = {};
      itemMonths[name][month] = qty;
    }
  }

  // Score seasonality: items that appear in < 60% of months but > 2 times
  const allMonths = Object.keys(monthMap).sort();
  const seasonal = [];
  for (const [name, months] of Object.entries(itemMonths)) {
    const count = Object.keys(months).length;
    if (count < 2) continue;
    const pct = count / allMonths.length;
    if (pct < 0.7 && count >= 2) {
      seasonal.push({ name, months, monthCount: count, pct: Math.round(pct * 100) });
    }
  }

  seasonal.sort((a, b) => b.monthCount - a.monthCount);
  res.json({ allMonths, seasonal: seasonal.slice(0, 40) });
});

app.get('/api/leket/monthly-spend', (req, res) => {
  const parsed = readLeket('parsed_orders.json');
  if (!parsed) return res.status(500).json({ error: 'No leket data' });

  const monthly = {};
  for (const order of parsed.orders || []) {
    if (!order.date) continue;
    const parts = order.date.split('/');
    if (parts.length < 2) continue;
    const month = `20${parts[2].slice(0,2)}-${parts[1].padStart(2,'0')}`;
    const spend = (order.items || []).reduce((s, i) => {
      return s + (parseFloat((i.total || '').replace(/[^\d.]/g, '')) || 0);
    }, 0);
    if (!monthly[month]) monthly[month] = { spend: 0, orders: 0 };
    monthly[month].spend = +(monthly[month].spend + spend).toFixed(2);
    monthly[month].orders++;
  }
  res.json(monthly);
});

// ── Shufersal items API (parsed) ────────────────────────────────────
const SHUFERSAL_DATA = path.join(__dirname, '..', 'shufersal', 'data');

function readShufersalParsed(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(SHUFERSAL_DATA, filename), 'utf8'));
  } catch(e) { return null; }
}

app.get('/api/shufersal/top-items', (req, res) => {
  const parsed = readShufersalParsed('parsed_orders.json');
  if (!parsed) return res.status(500).json({ error: 'No data' });
  res.json((parsed.item_summary || []).slice(0, 50));
});

app.get('/api/shufersal/seasonal', (req, res) => {
  const parsed = readShufersalParsed('parsed_orders.json');
  if (!parsed) return res.status(500).json({ error: 'No data' });

  const monthMap = {};
  for (const order of parsed.orders || []) {
    if (!order.date) continue;
    const month = order.date.slice(0, 7).replace('/', '-'); // YYYY-MM
    if (!monthMap[month]) monthMap[month] = {};
    for (const item of order.items || []) {
      monthMap[month][item.name] = (monthMap[month][item.name] || 0) + item.qty;
    }
  }

  const allMonths = Object.keys(monthMap).sort();
  const itemMonths = {};
  for (const [month, items] of Object.entries(monthMap)) {
    for (const [name, qty] of Object.entries(items)) {
      if (!itemMonths[name]) itemMonths[name] = {};
      itemMonths[name][month] = qty;
    }
  }

  const seasonal = [];
  for (const [name, months] of Object.entries(itemMonths)) {
    const count = Object.keys(months).length;
    if (count < 2 || count >= allMonths.length) continue;
    const pct = count / allMonths.length;
    if (pct < 0.75) {
      seasonal.push({ name, months, monthCount: count, pct: Math.round(pct * 100) });
    }
  }
  seasonal.sort((a, b) => b.monthCount - a.monthCount);
  res.json({ allMonths, seasonal: seasonal.slice(0, 40) });
});

app.get('/api/shufersal/monthly-spend', (req, res) => {
  const parsed = readShufersalParsed('parsed_orders.json');
  if (!parsed) return res.status(500).json({ error: 'No data' });

  const monthly = {};
  for (const order of parsed.orders || []) {
    if (!order.date) continue;
    const month = order.date.slice(0, 7);
    const spend = parseFloat((order.total || '').replace(/[^\d.]/g, '')) || 0;
    if (!monthly[month]) monthly[month] = { spend: 0, orders: 0 };
    monthly[month].spend = +(monthly[month].spend + spend).toFixed(2);
    monthly[month].orders++;
  }
  res.json(monthly);
});

// ── Homepage ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/shufersal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shufersal.html'));
});

app.get('/leket', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'leket.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏠 Personal Portal running at:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://192.168.68.115:${PORT}\n`);
});
