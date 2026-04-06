/**
 * shufersal/order.js
 * Adds predicted cart items to Shufersal cart via browser automation.
 * 
 * Usage:
 *   node order.js --dry-run    → show cart, don't touch site
 *   node order.js              → open browser, add items, leave open for checkout
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const DRY_RUN = process.argv.includes('--dry-run');
const DATA_DIR = path.join(__dirname, 'data');
const cartPath = path.join(DATA_DIR, 'predicted-cart.json');

if (!fs.existsSync(cartPath)) {
  console.error('No predicted cart found. Run analyze.js first.');
  process.exit(1);
}

const cart = JSON.parse(fs.readFileSync(cartPath, 'utf8'));
const estTotal = cart.reduce((s, p) => s + p.estimatedTotal, 0);

console.log(`🛒 Predicted Cart (${cart.length} items, ~₪${Math.round(estTotal)})`);
console.log('='.repeat(60));
cart.forEach((p, i) => {
  const conf = p.confidence === 'HIGH' ? '🔴' : '🟡';
  console.log(`${conf} ${i+1}. ${p.name}`);
  console.log(`   qty: ${p.suggestedQty} × ₪${p.avgUnitPrice} = ~₪${p.estimatedTotal} | last bought: ${p.daysSinceLast}d ago`);
});
console.log('='.repeat(60));
console.log(`Estimated total: ₪${Math.round(estTotal)}`);

if (DRY_RUN) {
  console.log('\n[DRY RUN] Pass no flags to actually order.');
  process.exit(0);
}

(async () => {
  console.log('\n🚀 Opening browser...');
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Login
  console.log('🔐 Logging in...');
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('#j_username', config.credentials.email);
  await page.fill('#j_password', config.credentials.password);
  await page.click('button.btn-login.btn-big');
  await page.waitForTimeout(4000);
  if (page.url().includes('/login')) { console.error('❌ Login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Logged in\n');

  const results = { added: [], failed: [], notFound: [] };

  for (const item of cart) {
    process.stdout.write(`Adding: ${item.name}... `);
    try {
      // Try direct product URL first (faster, more reliable)
      if (item.productCode) {
        await page.goto(`https://www.shufersal.co.il/online/he/p/${item.productCode}`, {
          waitUntil: 'domcontentloaded', timeout: 15000
        });
        await page.waitForTimeout(1500);

        // Check if product page loaded (not 404)
        const is404 = await page.locator('.error404, [class*="notFound"], h1:has-text("404")').count();
        if (!is404) {
          // Add to cart
          const addBtn = page.locator('.addToCartBtn, [class*="addToCart"], button:has-text("הוסף לסל")').first();
          if (await addBtn.count() > 0) {
            await addBtn.click();
            await page.waitForTimeout(800);
            // Set quantity if > 1
            if (item.suggestedQty > 1) {
              const qtyUp = page.locator('.bootstrap-touchspin-up').first();
              for (let q = 1; q < item.suggestedQty; q++) {
                await qtyUp.click();
                await page.waitForTimeout(200);
              }
            }
            console.log(`✅ (qty: ${item.suggestedQty})`);
            results.added.push(item.name);
            continue;
          }
        }
      }

      // Fallback: search by name
      await page.goto(`https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(item.name)}&searchType=PRODUCT`, {
        waitUntil: 'domcontentloaded', timeout: 15000
      });
      await page.waitForTimeout(1500);

      const addBtns = page.locator('.addToCartBtn, [class*="addToCart"]');
      const count = await addBtns.count();
      if (count > 0) {
        await addBtns.first().click();
        await page.waitForTimeout(800);
        console.log(`✅ via search (qty: ${item.suggestedQty})`);
        results.added.push(item.name);
      } else {
        console.log('⚠️  not found');
        results.notFound.push(item.name);
      }
    } catch (e) {
      console.log(`❌ ${e.message.substring(0, 60)}`);
      results.failed.push(item.name);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Added: ${results.added.length}/${cart.length}`);
  if (results.notFound.length) console.log(`⚠️  Not found: ${results.notFound.join(', ')}`);
  if (results.failed.length) console.log(`❌ Errors: ${results.failed.join(', ')}`);
  console.log('\n🛒 Browser is open — review your cart and complete checkout.');
  console.log('Press Ctrl+C when done.');

  fs.writeFileSync(path.join(DATA_DIR, 'last-order-result.json'), JSON.stringify({ ...results, timestamp: new Date().toISOString() }, null, 2));

  // Keep browser open for human checkout
  await new Promise(() => {});
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
