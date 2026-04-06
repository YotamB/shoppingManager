/**
 * scan_catalog.js
 * Scans lekethasade.co.il catalog categories and saves to JSON
 * Used by weekly_report.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EMAIL = process.env.LEKET_EMAIL;
const PASSWORD = process.env.LEKET_PASSWORD;
const OUT_FILE = path.join(__dirname, 'catalog_latest.json');

const CATEGORIES = [
  { name: 'ירקות', url: 'https://www.lekethasade.co.il/44575-%D7%99%D7%A8%D7%A7%D7%95%D7%AA' },
  { name: 'פירות', url: 'https://www.lekethasade.co.il/203266-%D7%A4%D7%99%D7%A8%D7%95%D7%AA' },
  { name: 'עשבי תיבול', url: 'https://www.lekethasade.co.il/44661-%D7%A2%D7%A9%D7%91%D7%99-%D7%AA%D7%99%D7%91%D7%95%D7%9C' },
  { name: 'ירקות גינה', url: 'https://www.lekethasade.co.il/44595-%D7%99%D7%A8%D7%A7%D7%95%D7%AA-%D7%92%D7%99%D7%A0%D7%94' },
  { name: 'פירות טריים', url: 'https://www.lekethasade.co.il/44577-%D7%A4%D7%99%D7%A8%D7%95%D7%AA-%D7%98%D7%A8%D7%99%D7%99%D7%9D' },
];

async function scanCategory(page, cat) {
  console.log(`  Scanning: ${cat.name}...`);
  await page.goto(cat.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Load all items (scroll / click "load more" if exists)
  let prevCount = 0;
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    const count = await page.locator('.layout_list_item').count();
    if (count === prevCount) break;
    prevCount = count;
    // Try "load more" button
    const loadMore = page.locator('a.load_more, button.load_more, [class*="load_more"]');
    if (await loadMore.count() > 0) {
      await loadMore.first().click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  const items = [];
  const itemEls = await page.locator('.layout_list_item').all();

  for (const el of itemEls) {
    // Name is in h3.title
    const nameEl = await el.locator('h3.title').first();
    const name = await nameEl.innerText().catch(() => '').then(t => t.trim().replace(/\s+/g, ' '));
    if (!name || name.length < 2) continue;

    // URL from the item link
    const link = el.locator('a[href*="current_customer/items"]').first();
    const href = await link.getAttribute('href').catch(() => null);

    // Price: item_kg_price
    const kgPrice = await el.locator('.item_kg_price').first().innerText().catch(() => '');
    const unitText = await el.locator('.text_for_unit').first().innerText().catch(() => '');
    const price = kgPrice ? `${kgPrice.trim()} ₪/${unitText.trim() || 'ק"ג'}` : '';

    // Check availability
    const outOfStock = await el.locator('[class*="out_of_stock"], [class*="unavailable"], .sold_out, .not_available').count() > 0;

    items.push({
      name,
      category: cat.name,
      price: price.trim().replace(/\s+/g, ' ').slice(0, 30),
      available: !outOfStock,
      url: href ? (href.startsWith('http') ? href : `https://www.lekethasade.co.il${href}`) : null,
    });
  }

  console.log(`    → ${items.length} items`);
  return items;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('🔐 Logging in...');
  await page.goto('https://www.lekethasade.co.il/customer_login', { waitUntil: 'networkidle' });
  await page.fill('#customer_session_username', EMAIL);
  await page.fill('#customer_session_password', PASSWORD);
  await page.locator('form#new_customer_session a[href="#customer"]').click();
  await page.waitForTimeout(3000);

  if (page.url().includes('customer_login')) {
    console.error('❌ Login failed');
    await browser.close();
    process.exit(1);
  }
  console.log('✅ Logged in\n');

  const allItems = [];
  for (const cat of CATEGORIES) {
    const items = await scanCategory(page, cat);
    allItems.push(...items);
  }

  // Deduplicate by name
  const seen = new Set();
  const unique = allItems.filter(item => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });

  const result = {
    scannedAt: new Date().toISOString(),
    totalItems: unique.length,
    items: unique,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\n✅ Catalog saved: ${unique.length} unique items → ${OUT_FILE}`);

  // Print sample
  console.log('\nSample:');
  unique.slice(0, 8).forEach(i => console.log(`  ${i.name} | ${i.price} | ${i.category}`));

  await browser.close();
  return result;
}

if (require.main === module) {
  run().catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { run };
