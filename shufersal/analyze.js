/**
 * shufersal/analyze.js
 * Reads data/orders.json, produces data/analysis.json + data/predicted-cart.json
 */
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const DATA_DIR = path.join(__dirname, 'data');
const ordersPath = path.join(DATA_DIR, 'orders.json');

if (!fs.existsSync(ordersPath)) {
  console.error('No orders data found. Run scrape.js first.');
  process.exit(1);
}

const rawOrders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));

// ── Parse into clean timeline ──
const orders = rawOrders
  .filter(o => o.entries && o.entries.length > 0)
  .map(o => ({
    code: o.code,
    date: new Date(o.created),
    total: o.totalPriceWithTax?.value || 0,
    items: o.entries.map(e => ({
      name: e.product?.name || 'Unknown',
      productCode: e.product?.code || '',
      qty: e.quantity || 1,
      unitPrice: e.basePrice?.value || 0,
      totalPrice: e.totalPrice?.value || 0,
      categories: e.product?.categories?.map(c => c.name) || []
    }))
  }))
  .sort((a, b) => a.date - b.date);

const totalOrders = orders.length;
const today = new Date();

// ── Per-product stats ──
const productMap = {};
for (const order of orders) {
  for (const item of order.items) {
    if (!productMap[item.productCode]) {
      productMap[item.productCode] = {
        name: item.name,
        productCode: item.productCode,
        categories: item.categories,
        appearances: []
      };
    }
    productMap[item.productCode].appearances.push({
      date: order.date,
      orderCode: order.code,
      qty: item.qty,
      unitPrice: item.unitPrice
    });
  }
}

const products = Object.values(productMap).map(p => {
  const n = p.appearances.length;
  const totalQty = p.appearances.reduce((s, a) => s + a.qty, 0);
  const avgQty = totalQty / n;
  const avgPrice = p.appearances.reduce((s, a) => s + a.unitPrice, 0) / n;
  const dates = p.appearances.map(a => a.date).sort((a, b) => a - b);
  const lastSeen = dates[dates.length - 1];
  const daysSinceLast = (today - lastSeen) / 86400000;

  // Average gap between purchases
  let avgGap = null;
  if (dates.length > 1) {
    const gaps = [];
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i-1]) / 86400000);
    avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }

  const frequency = n / totalOrders;
  const frequencyPct = Math.round(frequency * 100);

  return {
    name: p.name,
    productCode: p.productCode,
    categories: p.categories,
    orderCount: n,
    frequencyPct,
    avgQty: Math.round(avgQty * 10) / 10,
    avgUnitPrice: Math.round(avgPrice * 100) / 100,
    totalSpend: Math.round(p.appearances.reduce((s, a) => s + a.qty * a.unitPrice, 0) * 100) / 100,
    avgGapDays: avgGap ? Math.round(avgGap) : null,
    lastSeenDate: lastSeen.toISOString().split('T')[0],
    daysSinceLast: Math.round(daysSinceLast)
  };
});

// ── Order gap stats ──
const orderDates = orders.map(o => o.date);
const gaps = [];
for (let i = 1; i < orderDates.length; i++) {
  const g = (orderDates[i] - orderDates[i-1]) / 86400000;
  if (g > 3) gaps.push(g);
}
const avgOrderGap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
const daysSinceLastOrder = Math.round((today - orderDates[orderDates.length - 1]) / 86400000);

// ── Predict next cart ──
const exclude = config.settings.excludeCategories || [];
const minFreq = config.settings.minFrequencyPct || 20;
const minScore = config.settings.minNeedScore || 0.7;

const predicted = products
  .filter(p => p.frequencyPct >= minFreq)
  .filter(p => !exclude.some(ex => p.name.includes(ex)))
  .map(p => {
    const cycle = p.avgGapDays || avgOrderGap;
    const needScore = p.daysSinceLast / cycle;
    return { ...p, needScore: Math.round(needScore * 100) / 100 };
  })
  .filter(p => p.needScore >= minScore)
  .sort((a, b) => b.needScore - a.needScore);

// ── Summary ──
const summary = {
  generatedAt: today.toISOString(),
  totalOrders,
  dateRange: {
    from: orders[0].date.toISOString().split('T')[0],
    to: orders[orders.length - 1].date.toISOString().split('T')[0]
  },
  totalSpend: Math.round(orders.reduce((s, o) => s + o.total, 0) * 100) / 100,
  avgOrderValue: Math.round(orders.reduce((s, o) => s + o.total, 0) / totalOrders * 100) / 100,
  avgOrderGapDays: avgOrderGap,
  daysSinceLastOrder,
  daysOverdue: Math.max(0, daysSinceLastOrder - avgOrderGap),
  uniqueProducts: products.length,
  staples: products.filter(p => p.orderCount >= 3).length
};

const analysis = { summary, products: products.sort((a, b) => b.frequencyPct - a.frequencyPct || b.avgQty - a.avgQty) };
const cart = predicted.map(p => ({
  name: p.name,
  productCode: p.productCode,
  suggestedQty: Math.ceil(p.avgQty),
  avgUnitPrice: p.avgUnitPrice,
  estimatedTotal: Math.round(Math.ceil(p.avgQty) * p.avgUnitPrice * 100) / 100,
  confidence: p.needScore >= 1.2 ? 'HIGH' : 'MEDIUM',
  needScore: p.needScore,
  daysSinceLast: p.daysSinceLast,
  frequencyPct: p.frequencyPct
}));

fs.writeFileSync(path.join(DATA_DIR, 'analysis.json'), JSON.stringify(analysis, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'predicted-cart.json'), JSON.stringify(cart, null, 2));

console.log('📊 Analysis Summary');
console.log('===================');
console.log(`Orders: ${summary.totalOrders} | Period: ${summary.dateRange.from} → ${summary.dateRange.to}`);
console.log(`Total spend: ₪${summary.totalSpend.toLocaleString()} | Avg: ₪${summary.avgOrderValue}`);
console.log(`Shop frequency: every ${summary.avgOrderGapDays} days`);
console.log(`Days since last order: ${summary.daysSinceLastOrder} (${summary.daysOverdue > 0 ? summary.daysOverdue + ' days overdue! 🚨' : 'on schedule ✅'})`);
console.log(`Staple products: ${summary.staples} | Predicted cart: ${cart.length} items`);
console.log(`Estimated next order: ₪${cart.reduce((s, p) => s + p.estimatedTotal, 0).toFixed(0)}`);
console.log(`\n💾 Saved to data/analysis.json + data/predicted-cart.json`);
