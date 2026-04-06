const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('Navigating to Shufersal login...');
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('Filling login form...');
  await page.fill('#j_username', process.env.LEKET_EMAIL);
  await page.fill('#j_password', 'pyT6bcJArC4YLv');

  console.log('Submitting...');
  await page.click('button.btn-login.btn-big');
  await page.waitForTimeout(4000);

  const currentUrl = page.url();
  console.log('After login URL:', currentUrl);
  await page.screenshot({ path: '/tmp/shufersal-after-login.png' });

  if (currentUrl.includes('/login')) {
    // Check for error message
    const errorText = await page.evaluate(() => {
      const err = document.querySelector('.errorMessage, .error-message, [class*="error"], .alert');
      return err ? err.innerText.trim() : null;
    });
    console.log('Still on login page. Error message:', errorText || 'none visible');
    await browser.close();
    process.exit(1);
  }

  console.log('Login successful! Navigating to order history...');
  await page.goto('https://www.shufersal.co.il/online/he/my-account/orders', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log('Orders page URL:', page.url());
  await page.screenshot({ path: '/tmp/shufersal-orders.png' });

  // Extract order data
  const orders = await page.evaluate(() => {
    const results = [];
    const orderRows = document.querySelectorAll('[class*="order-row"], [class*="orderRow"], .order-item, [class*="order-history"] li, .orders-list li, table tr');
    orderRows.forEach(row => {
      const text = row.innerText.trim();
      if (text.length > 5) results.push(text);
    });
    return results;
  });

  console.log(`Found ${orders.length} order rows`);
  fs.writeFileSync('/tmp/shufersal-orders.json', JSON.stringify(orders, null, 2));

  // Also save full page HTML for inspection
  const html = await page.content();
  fs.writeFileSync('/tmp/shufersal-orders.html', html);

  orders.slice(0, 10).forEach((o, i) => console.log(`Row ${i+1}:`, o.substring(0, 150)));

  await browser.close();
  console.log('Done!');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
