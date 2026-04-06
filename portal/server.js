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

// ── Homepage ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/shufersal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shufersal.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏠 Personal Portal running at http://localhost:${PORT}\n`);
});
