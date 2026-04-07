const { chromium } = require('playwright');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const ITEMS = [
  'חלב בקרטון 3% שומן',
  'קפסולות Starbucks האוס',
  'מרכך כביסה מרוכז BREEZ',
  'אבקת כביסה סנסטיב',
  'מגבונים לחים מארז ענק',
  'קלינקס לושן 3 שכבות 120',
  'גרעיני תירס לפופקורן',
  'סוויטאנגו 280 גרם',
  'תרסיס מסיר כתמים XPO',
  'ג\'ל מסיר כתמים צבעוני XPO 3 ליטר',
  'מסיר כתמים קשים Lu',
  'שקיות אשפה XL חזקות XPO',
];

const results = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Login
  console.log('🔐 מתחבר...');
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Fill login form
  try {
    await page.fill('input[type="email"], input[name="j_username"], #loginEmail', config.credentials.email);
    await page.fill('input[type="password"], input[name="j_password"], #loginPassword', config.credentials.password);
    await page.click('button[type="submit"], .login-btn, #loginBtn');
    await page.waitForTimeout(3000);
    console.log('✅ התחברתי');
  } catch (e) {
    console.log('⚠️ בעיה בכניסה:', e.message);
  }

  // Add each item to cart
  for (const item of ITEMS) {
    console.log(`\n🔍 מחפש: ${item}`);
    try {
      const searchUrl = `https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(item)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);

      // Find first add-to-cart button
      const addBtn = page.locator('.addToCart, .add-to-cart, [data-action="add"], button.js-add-item').first();
      const count = await addBtn.count();

      if (count > 0) {
        const productName = await page.locator('.miglog-prod-name, .product-name').first().textContent().catch(() => 'לא ידוע');
        await addBtn.click();
        await page.waitForTimeout(1500);
        console.log(`  ✅ נוסף: ${productName.trim()}`);
        results.push({ item, status: 'added', product: productName.trim() });
      } else {
        console.log(`  ❌ לא נמצא כפתור הוספה`);
        results.push({ item, status: 'not_found' });
      }
    } catch (e) {
      console.log(`  ❌ שגיאה: ${e.message}`);
      results.push({ item, status: 'error', error: e.message });
    }
  }

  await browser.close();

  console.log('\n\n📋 סיכום:');
  for (const r of results) {
    const icon = r.status === 'added' ? '✅' : '❌';
    console.log(`${icon} ${r.item}${r.product ? ` → ${r.product}` : ''}`);
  }

  fs.writeFileSync('./data/cart_build_results.json', JSON.stringify(results, null, 2));
  console.log('\nנשמר ב-data/cart_build_results.json');
})();
