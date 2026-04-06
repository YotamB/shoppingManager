const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('#j_username', process.env.LEKET_EMAIL);
  await page.fill('#j_password', 'pyT6bcJArC4YLv');
  await page.click('button.btn-login.btn-big');
  await page.waitForTimeout(4000);

  if (page.url().includes('/login')) {
    console.error('Login failed!');
    await browser.close();
    process.exit(1);
  }
  console.log('Logged in. Fetching order list...');

  // Get order list via API
  const ordersResp = await page.goto('https://www.shufersal.co.il/online/he/my-account/orders', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  const ordersHtml = await page.content();
  const ordersMatch = ordersHtml.match(/<pre>([\s\S]*?)<\/pre>/);
  const ordersData = JSON.parse(ordersMatch[1]);
  const allOrders = [...(ordersData.activeOrders || []), ...(ordersData.closedOrders || [])];
  console.log(`Found ${allOrders.length} orders. Fetching details for each...`);

  const detailed = [];

  for (const order of allOrders) {
    console.log(`Fetching order ${order.code}...`);
    try {
      await page.goto(`https://www.shufersal.co.il/online/he/my-account/orders/${order.code}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      const html = await page.content();
      const match = html.match(/<pre>([\s\S]*?)<\/pre>/);
      if (match) {
        const detail = JSON.parse(match[1]);
        detailed.push(detail);
        console.log(`  Order ${order.code}: ${detail.entries?.length || 0} items, total ${order.totalPriceWithTax?.formattedValue}`);
      } else {
        // Try to extract from page HTML directly
        console.log(`  Order ${order.code}: no JSON found, saving HTML`);
        fs.writeFileSync(`/tmp/shufersal-order-${order.code}.html`, html);
        detailed.push({ code: order.code, total: order.totalPriceWithTax, error: 'no json' });
      }
    } catch (e) {
      console.log(`  Order ${order.code}: error - ${e.message}`);
      detailed.push({ code: order.code, error: e.message });
    }
  }

  fs.writeFileSync('/tmp/shufersal-all-orders-detailed.json', JSON.stringify(detailed, null, 2));
  console.log('All orders saved to /tmp/shufersal-all-orders-detailed.json');

  await browser.close();
})().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
