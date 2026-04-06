/**
 * shufersal/scrape.js
 * Logs in, fetches all orders + full item details, saves to data/orders.json
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: config.settings.headless });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // ── Login ──
  console.log('🔐 Logging in...');
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('#j_username', config.credentials.email);
  await page.fill('#j_password', config.credentials.password);
  await page.click('button.btn-login.btn-big');
  await page.waitForTimeout(4000);
  if (page.url().includes('/login')) { console.error('❌ Login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Logged in');

  // ── Fetch order list ──
  await page.goto('https://www.shufersal.co.il/online/he/my-account/orders', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  const listHtml = await page.content();
  const listMatch = listHtml.match(/<pre>([\s\S]*?)<\/pre>/);
  if (!listMatch) { console.error('❌ Could not parse order list'); await browser.close(); process.exit(1); }
  const listData = JSON.parse(listMatch[1]);
  const allOrders = [...(listData.activeOrders || []), ...(listData.closedOrders || [])];
  console.log(`📦 Found ${allOrders.length} orders`);

  // ── Fetch each order detail ──
  const detailed = [];
  for (const order of allOrders) {
    process.stdout.write(`  Fetching ${order.code}... `);
    try {
      await page.goto(`https://www.shufersal.co.il/online/he/my-account/orders/${order.code}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000);
      const html = await page.content();
      const match = html.match(/<pre>([\s\S]*?)<\/pre>/);
      if (match) {
        const detail = JSON.parse(match[1]);
        detailed.push(detail);
        console.log(`✅ ${detail.entries?.length || 0} items`);
      } else {
        console.log('⚠️  no JSON');
        detailed.push({ code: order.code, totalPriceWithTax: order.totalPriceWithTax, created: order.created, entries: [] });
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
      detailed.push({ code: order.code, error: e.message, entries: [] });
    }
  }

  const outPath = path.join(DATA_DIR, 'orders.json');
  fs.writeFileSync(outPath, JSON.stringify(detailed, null, 2));
  console.log(`\n💾 Saved ${detailed.length} orders to ${outPath}`);
  await browser.close();
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
