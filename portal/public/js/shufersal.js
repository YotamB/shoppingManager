/* ── Helpers ─────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const fmt = (n, decimals = 0) =>
  n == null ? '—' : Number(n).toLocaleString('he-IL', { maximumFractionDigits: decimals });
const fmtShekels = n =>
  n == null ? '—' : `₪${fmt(n, 0)}`;
const fmtShekelsDec = n =>
  n == null ? '—' : `₪${fmt(n, 2)}`;
const dayLabel = n =>
  n == null ? '—' : `${n} ימים`;

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ── Summary Bar ─────────────────────────────────────────────────────────── */
async function loadSummary() {
  const s = await fetchJSON('/api/shufersal/summary');

  const overdue = s.daysUntilNextPredicted < 0;
  const overdueDays = Math.abs(s.daysUntilNextPredicted);

  // Overdue banner
  if (overdue) {
    const banner = $('overdue-banner');
    $('overdue-text').textContent =
      `⚠️ הזמנה איחרה ב-${overdueDays} ימים! (${s.daysSinceLastOrder} ימים מאז ההזמנה האחרונה)`;
    banner.style.display = 'flex';
  }

  const stats = [
    {
      label: 'סה"כ הזמנות',
      value: s.totalOrders,
      sub: `${new Date(s.dateRange.from).toLocaleDateString('he-IL')} – ${new Date(s.dateRange.to).toLocaleDateString('he-IL')}`,
    },
    {
      label: 'סה"כ הוצאות',
      value: `₪${fmt(s.totalSpend, 0)}`,
      sub: `ממוצע ₪${fmt(s.avgOrderValue, 0)} להזמנה`,
    },
    {
      label: 'ימים מאז הזמנה אחרונה',
      value: s.daysSinceLastOrder,
      sub: `ממוצע ${s.avgDaysBetweenOrders} ימים בין הזמנות`,
      overdue,
    },
    {
      label: overdue ? 'איחור בהזמנה' : 'ימים עד הזמנה הבאה',
      value: overdue ? `+${overdueDays}` : s.daysUntilNextPredicted,
      sub: overdue ? 'כדאי להזמין עכשיו' : 'לפי חיזוי',
      overdue,
    },
  ];

  const grid = $('stat-grid');
  grid.innerHTML = stats.map(s => `
    <div class="stat-card${s.overdue ? ' overdue' : ''}">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-sub">${s.sub}</div>
    </div>
  `).join('');
}

/* ── Spending Bar Chart (from order summaries) ───────────────────────────── */
async function loadChart() {
  const analysis = await fetchJSON('/api/shufersal/analysis');
  const orders = analysis.orderSummaries || [];

  // Group by YYYY-MM
  const byMonth = {};
  for (const o of orders) {
    // date format: "28.1.2026" → parse
    const parts = o.date.split('.');
    if (parts.length < 3) continue;
    const d = parts[2] + '-' + parts[1].padStart(2, '0');
    const amount = parseFloat((o.total || '0').replace(/[₪,\s]/g, ''));
    byMonth[d] = (byMonth[d] || 0) + amount;
  }

  const months = Object.keys(byMonth).sort();
  if (!months.length) {
    $('bar-chart').innerHTML = '<div class="loading">אין נתוני הוצאות</div>';
    return;
  }

  const maxVal = Math.max(...months.map(m => byMonth[m]));

  const labelMap = {
    '01': 'ינו', '02': 'פבר', '03': 'מרץ', '04': 'אפר',
    '05': 'מאי', '06': 'יונ', '07': 'יול', '08': 'אוג',
    '09': 'ספט', '10': 'אוק', '11': 'נוב', '12': 'דצמ',
  };

  const chart = $('bar-chart');
  chart.innerHTML = months.map(m => {
    const val = byMonth[m];
    const pct = (val / maxVal) * 100;
    const [year, mon] = m.split('-');
    const label = `${labelMap[mon] || mon} ${year.slice(2)}`;
    return `
      <div class="bar-col">
        <div class="bar-val">${fmtShekels(val)}</div>
        <div class="bar" style="height:${Math.max(pct, 1)}%"
             data-tip="${label}: ${fmtShekels(val)}"></div>
        <div class="bar-label">${label}</div>
      </div>`;
  }).join('');
}

/* ── Staples ─────────────────────────────────────────────────────────────── */
async function loadStaples() {
  const staples = await fetchJSON('/api/shufersal/staples');
  $('staples-count').textContent = staples.length;

  const tbody = $('staples-body');
  if (!staples.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading">אין נתונים</td></tr>';
    return;
  }

  tbody.innerHTML = staples.map(s => `
    <tr>
      <td class="rtl" style="font-weight:500">${s.name}</td>
      <td>
        <div class="freq-bar-wrap">
          <div class="freq-bar-bg">
            <div class="freq-bar-fill" style="width:${s.frequencyPct}%"></div>
          </div>
          <span class="freq-pct">${s.frequencyPct}%</span>
        </div>
      </td>
      <td>${fmt(s.avgQtyPerOrder, 1)}</td>
      <td>${fmtShekelsDec(s.avgUnitPrice)}</td>
      <td data-tip="קנוי ב-${s.boughtInOrders} הזמנות">${dayLabel(s.avgDaysBetweenPurchases)}</td>
    </tr>
  `).join('');
}

/* ── Predicted Next Order ────────────────────────────────────────────────── */
async function loadPredicted() {
  const items = await fetchJSON('/api/shufersal/predicted');
  $('predicted-count').textContent = items.length + ' פריטים';

  const tbody = $('predicted-body');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading">אין נתונים</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(item => {
    const priceStr = item.avgPrice > 0 ? fmtShekelsDec(item.avgPrice) : '—';
    const qtyRounded = Math.ceil(item.suggestedQty * 10) / 10;
    return `
      <tr>
        <td class="rtl" style="font-weight:500">${item.name}</td>
        <td><span class="badge-conf ${item.confidence}">${item.confidence}</span></td>
        <td>${fmt(qtyRounded, 1)}</td>
        <td>${priceStr}</td>
        <td>${item.daysSinceLastBought != null ? item.daysSinceLastBought + ' ימים' : '—'}</td>
      </tr>`;
  }).join('');
}

/* ── Order History ───────────────────────────────────────────────────────── */
async function loadOrders() {
  const analysis = await fetchJSON('/api/shufersal/analysis');
  const orders = analysis.orderSummaries || [];
  const tbody = $('orders-body');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading">אין הזמנות</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-family:monospace;font-size:0.82rem;color:var(--muted)">${o.code}</td>
      <td>${o.date}</td>
      <td style="font-weight:600">${o.total}</td>
      <td>${o.items} פריטים</td>
    </tr>
  `).join('');
}

/* ── Build Cart button ───────────────────────────────────────────────────── */
function initBuildCart() {
  const btn = $('btn-build-cart');
  const result = $('cart-result');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = '⏳ מכין עגלה…';

    try {
      const data = await fetch('/api/shufersal/build-cart', { method: 'POST' }).then(r => r.json());

      result.innerHTML = `
        <h3>✅ עגלה מוכנה!</h3>
        <div class="cart-meta">
          ${data.itemCount} פריטים · עלות משוערת <strong>${fmtShekels(data.estimatedTotal)}</strong>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="rtl">מוצר</th>
                <th>כמות</th>
                <th>מחיר יח'</th>
                <th>סה"כ משוער</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map(i => `
                <tr>
                  <td class="rtl">${i.name}</td>
                  <td>${i.qty}</td>
                  <td>${i.estPrice > 0 ? fmtShekelsDec(i.estPrice) : '—'}</td>
                  <td>${i.estTotal > 0 ? fmtShekels(i.estTotal) : '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
      result.classList.add('visible');
    } catch (e) {
      result.innerHTML = `<div class="error">שגיאה: ${e.message}</div>`;
      result.classList.add('visible');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🛒 Build Cart';
    }
  });
}

/* ── Init ────────────────────────────────────────────────────────────────── */
(async function init() {
  initBuildCart();

  await Promise.allSettled([
    loadSummary().catch(e => console.error('summary:', e)),
    loadChart().catch(e => console.error('chart:', e)),
    loadStaples().catch(e => console.error('staples:', e)),
    loadPredicted().catch(e => console.error('predicted:', e)),
    loadOrders().catch(e => console.error('orders:', e)),
  ]);
})();
