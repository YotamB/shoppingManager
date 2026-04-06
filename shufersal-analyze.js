const fs = require('fs');

const orders = JSON.parse(fs.readFileSync('/tmp/shufersal-all-orders-detailed.json', 'utf8'));

// Parse orders into clean timeline
const timeline = orders
  .filter(o => o.entries)
  .map(o => ({
    code: o.code,
    date: new Date(o.created),
    total: o.totalPriceWithTax?.value || 0,
    entries: o.entries.map(e => ({
      name: e.product?.name || 'Unknown',
      code: e.product?.code || '',
      qty: e.quantity || 1,
      unitPrice: e.basePrice?.value || 0,
      totalPrice: e.totalPrice?.value || 0,
      category: e.product?.categories?.[0]?.name || 'Unknown'
    }))
  }))
  .sort((a, b) => a.date - b.date);

console.log(`Parsed ${timeline.length} orders from ${timeline[0].date.toLocaleDateString()} to ${timeline[timeline.length-1].date.toLocaleDateString()}`);

// === STAPLES ANALYSIS ===
// Products bought in N or more orders
const productOrders = {}; // product -> list of {date, qty, price}
for (const order of timeline) {
  for (const e of order.entries) {
    if (!productOrders[e.name]) productOrders[e.name] = [];
    productOrders[e.name].push({ date: order.date, qty: e.qty, price: e.unitPrice, orderCode: order.code });
  }
}

const totalOrders = timeline.length;
const productStats = Object.entries(productOrders).map(([name, appearances]) => {
  const orderCount = appearances.length;
  const totalQty = appearances.reduce((s, a) => s + a.qty, 0);
  const avgQty = totalQty / orderCount;
  const avgPrice = appearances.reduce((s, a) => s + a.price, 0) / orderCount;
  const frequency = orderCount / totalOrders; // 0-1, how often it appears
  // Days between purchases
  const dates = appearances.map(a => a.date).sort((a,b) => a-b);
  let avgDaysBetween = null;
  if (dates.length > 1) {
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24));
    }
    avgDaysBetween = gaps.reduce((a,b) => a+b, 0) / gaps.length;
  }
  return { name, orderCount, frequency, avgQty: Math.round(avgQty*100)/100, avgPrice, totalQty, avgDaysBetween, lastSeen: dates[dates.length-1] };
});

// Sort by frequency then qty
const staples = productStats.filter(p => p.orderCount >= 3).sort((a,b) => b.frequency - a.frequency || b.avgQty - a.avgQty);
const occasional = productStats.filter(p => p.orderCount === 2).sort((a,b) => b.avgQty - a.avgQty);
const oneoffs = productStats.filter(p => p.orderCount === 1);

console.log(`\nStaples (3+ orders): ${staples.length} products`);
console.log(`Occasional (2 orders): ${occasional.length} products`);
console.log(`One-offs: ${oneoffs.length} products`);

// === GAP ANALYSIS ===
// Days between orders
const orderDates = timeline.map(o => o.date);
const orderGaps = [];
for (let i = 1; i < orderDates.length; i++) {
  const gap = (orderDates[i] - orderDates[i-1]) / (1000 * 60 * 60 * 24);
  if (gap > 3) orderGaps.push(gap); // ignore same-day orders
}
const avgOrderGap = orderGaps.reduce((a,b)=>a+b,0) / orderGaps.length;
const lastOrderDate = orderDates[orderDates.length-1];
const daysSinceLast = (new Date('2026-04-02') - lastOrderDate) / (1000 * 60 * 60 * 24);

console.log(`\nAvg days between orders: ${Math.round(avgOrderGap)}`);
console.log(`Days since last order: ${Math.round(daysSinceLast)}`);
console.log(`Next predicted order: ~${Math.round(avgOrderGap - daysSinceLast)} days from now`);

// === NEXT ORDER PREDICTION ===
// For each staple, predict if it should be in next order based on:
// - frequency (how often they buy it)
// - days since last seen vs avg days between purchases
const nextOrder = [];
const today = new Date('2026-04-02');

for (const p of staples) {
  const daysSinceLastBought = (today - p.lastSeen) / (1000 * 60 * 60 * 24);
  // Predict needed if: days since last >= avg cycle (or no cycle data but high frequency)
  const cycle = p.avgDaysBetween || avgOrderGap;
  const needScore = daysSinceLastBought / cycle; // >1 means overdue
  nextOrder.push({ ...p, daysSinceLastBought: Math.round(daysSinceLastBought), cycle: Math.round(cycle), needScore: Math.round(needScore*100)/100 });
}

nextOrder.sort((a,b) => b.needScore - a.needScore);

// Also add high-frequency occasionals
for (const p of occasional) {
  const daysSinceLastBought = (today - p.lastSeen) / (1000 * 60 * 60 * 24);
  const cycle = p.avgDaysBetween || avgOrderGap * 1.5;
  const needScore = daysSinceLastBought / cycle;
  if (needScore > 0.8) nextOrder.push({ ...p, daysSinceLastBought: Math.round(daysSinceLastBought), cycle: Math.round(cycle), needScore: Math.round(needScore*100)/100 });
}

// === OUTPUT REPORT ===
const report = {
  summary: {
    totalOrders: timeline.length,
    dateRange: { from: timeline[0].date, to: timeline[timeline.length-1].date },
    totalSpend: Math.round(timeline.reduce((s,o)=>s+o.total,0)*100)/100,
    avgOrderValue: Math.round(timeline.reduce((s,o)=>s+o.total,0)/timeline.length*100)/100,
    avgDaysBetweenOrders: Math.round(avgOrderGap),
    daysSinceLastOrder: Math.round(daysSinceLast),
    daysUntilNextPredicted: Math.round(avgOrderGap - daysSinceLast)
  },
  staples: staples.map(p => ({
    name: p.name,
    boughtInOrders: p.orderCount,
    frequencyPct: Math.round(p.frequency*100),
    avgQtyPerOrder: p.avgQty,
    avgUnitPrice: Math.round(p.avgPrice*100)/100,
    avgDaysBetweenPurchases: p.avgDaysBetween ? Math.round(p.avgDaysBetween) : null
  })),
  occasional,
  predictedNextOrder: nextOrder.slice(0, 40).map(p => ({
    name: p.name,
    suggestedQty: p.avgQty,
    confidence: p.needScore > 1.2 ? 'HIGH' : p.needScore > 0.7 ? 'MEDIUM' : 'LOW',
    needScore: p.needScore,
    daysSinceLastBought: p.daysSinceLastBought,
    avgPrice: Math.round(p.avgPrice*100)/100
  }))
};

fs.writeFileSync('/tmp/shufersal-full-report.json', JSON.stringify(report, null, 2));

// Human-readable summary
console.log('\n========== FULL STAPLES LIST ==========');
staples.forEach((p,i) => {
  console.log(`${i+1}. ${p.name} | ${p.orderCount}/${totalOrders} orders (${Math.round(p.frequency*100)}%) | avg qty: ${p.avgQty} | avg price: ₪${Math.round(p.avgPrice*100)/100}`);
});

console.log('\n========== PREDICTED NEXT ORDER ==========');
const highConf = nextOrder.filter(p => p.needScore > 0.7).slice(0, 40);
let estTotal = 0;
highConf.forEach((p,i) => {
  const conf = p.needScore > 1.2 ? '🔴' : '🟡';
  const lineTotal = p.avgQty * p.avgPrice;
  estTotal += lineTotal;
  console.log(`${conf} ${p.name} | qty: ${p.avgQty} | ~₪${Math.round(p.avgPrice*100)/100} each | last bought: ${p.daysSinceLastBought}d ago`);
});
console.log(`\nEstimated order total: ₪${Math.round(estTotal)}`);

console.log('\nReport saved to /tmp/shufersal-full-report.json');
