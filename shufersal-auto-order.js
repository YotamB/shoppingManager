/**
 * Shufersal Auto-Order
 * 
 * Reads predicted next order from analysis and adds items to cart.
 * Run with: node shufersal-auto-order.js [--dry-run] [--confirm]
 * 
 * --dry-run: just show what would be ordered, don't touch cart
 * --confirm: actually add to cart (still requires human checkout)
 */

const { chromium } = require('playwright');
const fs = require('fs');

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--confirm');
const report = JSON.parse(fs.readFileSync('/tmp/shufersal-full-report.json', 'utf8'));

// Filter to high-confidence items only, exclude delivery/fees
const cart = report.predictedNextOrder
  .filter(p => p.confidence === 'HIGH' || p.confidence === 'MEDIUM')
  .filter(p => !p.name.includes('משלוח') && !p.name.includes('דמי'))
  .map(p => ({ name: p.name, qty: Math.ceil(p.suggestedQty), estPrice: p.avgPrice }));

const estTotal = cart.reduce((s, p) => s + p.qty * p.estPrice, 0);

console.log('=== PREDICTED CART ===');
cart.forEach((p, i) => console.log(`${i+1}. ${p.name} × ${p.qty} (~₪${(p.qty * p.estPrice).toFixed(0)})`));
console.log(`\nEstimated total: ₪${Math.round(estTotal)}`);
console.log(`Items: ${cart.length}`);

if (DRY_RUN) {
  console.log('\n[DRY RUN] Not adding to cart. Run with --confirm to proceed.');
  fs.writeFileSync('/tmp/shufersal-predicted-cart.json', JSON.stringify(cart, null, 2));
  console.log('Cart saved to /tmp/shufersal-predicted-cart.json');
  process.exit(0);
}

// === ACTUAL ORDER FLOW ===
(async () => {
  console.log('\nStarting browser...');
  const browser = await chromium.launch({ headless: false }); // visible so user can confirm
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

  console.log('Logged in. Starting to add items...');
  let added = 0;
  let failed = [];

  for (const item of cart) {
    console.log(`Searching for: ${item.name}...`);
    try {
      // Search for item
      await page.goto(`https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(item.name)}&searchType=PRODUCT`, {
        waitUntil: 'domcontentloaded', timeout: 20000
      });
      await page.waitForTimeout(2000);

      // Wait for product tiles to load
      await page.waitForSelector('li.tileBlock', { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(1000);

      // Get first product tile
      const productTile = page.locator('li.tileBlock').first();
      const tileExists = await productTile.count();
      if (!tileExists) {
        console.log(`  ✗ Not found: ${item.name}`);
        failed.push(item.name);
        continue;
      }

      // Use JS to directly trigger the add-to-cart button, bypassing CSS visibility
      const addBtn = productTile.locator('.js-add-to-cart').first();
      const exists = await addBtn.count();
      if (exists > 0) {
        // Dispatch click via JS to bypass display:none
        await addBtn.evaluate(el => el.click());
        await page.waitForTimeout(1500);

        // Set quantity using + button (also via JS click)
        if (item.qty > 1) {
          for (let q = 1; q < item.qty; q++) {
            const plusBtn = productTile.locator('.add-item').first();
            const pExists = await plusBtn.count();
            if (pExists > 0) {
              await plusBtn.evaluate(el => el.click());
              await page.waitForTimeout(400);
            } else break;
          }
        }
        console.log(`  ✓ Added: ${item.name} × ${item.qty}`);
        added++;
      } else {
        console.log(`  ✗ No add button: ${item.name}`);
        failed.push(item.name);
      }
    } catch (e) {
      console.log(`  ✗ Error: ${item.name} — ${e.message}`);
      failed.push(item.name);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Added: ${added}/${cart.length} items`);
  if (failed.length > 0) console.log(`Failed: ${failed.join(', ')}`);
  console.log('\nBrowser left open for you to review cart and checkout.');
  console.log('Press Ctrl+C when done.');

  // Keep browser open for human review before checkout
  await new Promise(() => {}); // wait forever
})().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
