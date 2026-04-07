const { chromium } = require('playwright');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const basket = JSON.parse(fs.readFileSync('./data/saved_basket.json', 'utf8'));

const searchQueries = {
  "חלב בקרטון 3% שומן": "חלב בקרטון 3%",
  "קפסולות Starbucks האוס": "Starbucks האוס",
  "מרכך כביסה מרוכז BREEZ": "מרכך כביסה BREEZ",
  "אבקת כביסה סנסטיב": "אבקת כביסה סנסטיב",
  "מגבונים לחים מארז ענק": "מגבונים לחים מארז ענק",
  "קלינקס לושן 3 שכבות 120 יח'": "קלינקס לושן 120",
  "גרעיני תירס לפופקורן": "גרעיני תירס פופקורן",
  "סוויטאנגו 280 גרם": "סוויטאנגו",
  "תרסיס מסיר כתמים XPO": "תרסיס מסיר כתמים XPO",
  "ג'ל מסיר כתמים צבעוני XPO 3 ליטר": "ג'ל מסיר כתמים XPO 3 ליטר",
  "מסיר כתמים קשים Lu": "מסיר כתמים Lu",
  "שקיות אשפה XL חזקות XPO": "שקיות אשפה XL XPO",
  'סוכריות מנטה לל"ס': 'מנטה לל"ס',
  "ביצי הפתעה קינדר": "ביצי הפתעה קינדר",
  "תמר מג'הול אורגני": "תמר מג'הול אורגני",
  "אל סבון לילדים": "אל סבון לילדים",
  "גבינת בייבי בל": "בייבי בל",
  "סנו ג'אוול לימון": "ג'אוול לימון",
  "סבון מוצק אובליפיחה - שביט": "סבון אובליפיחה שביט",
  "עץ התה סבון מוצק - שביט": "עץ התה סבון שביט",
  "סבון נסטי ליפט": "נסטי ליפט",
  "סבון אורגני פטל וסרפד - נסטי": "נסטי פטל סרפד",
  "סבון אורגני ארגן וחציר - נסטי": "נסטי ארגן חציר",
  'שמפו דאב 400מ"ל': "שמפו דאב 400",
  "Muller Droop לימון": "פרופ קציפת לימון",
  "Muller Droop אפרסק פסיפלורה": "פרופ קציפת אפרסק פסיפלורה",
  "Muller Droop פירות יער": "פרופ קציפת פירות יער",
  "Muller Droop תות": "פרופ קציפת תות",
  "Muller Droop פטל": "פרופ קציפת פטל",
  "מולר יוגורט אפרסק 3%": "יוגורט אפרסק 3% מולר",
  "מולר יוגורט תות 3%": "יוגורט תות 3% מולר",
  "מולר יוגורט קיווי 3%": "יוגורט קיווי 3% מולר",
  "מולר יוגורט מנגו 3%": "יוגורט מנגו 3% מולר",
  "מולר יוגורט פירות יער 3%": "יוגורט פירות יער 3% מולר",
  "לאבנה פיראוס 5%": "לאבנה פיראוס",
};

async function addItem(page, itemName) {
  const query = searchQueries[itemName] || itemName;

  // Listen for cart API calls
  let cartRequestFired = false;
  const handler = req => {
    if (req.url().includes('/cart') && req.method() === 'POST') cartRequestFired = true;
  };
  page.on('request', handler);

  await page.goto(
    `https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(query)}`,
    { waitUntil: 'networkidle', timeout: 25000 }
  );

  // Wait for products
  try {
    await page.waitForSelector('button.js-add-to-cart', { timeout: 8000 });
  } catch {
    page.off('request', handler);
    return { status: 'no_products' };
  }

  // Click the ACTUAL add button (not the wrapper)
  const btn = page.locator('button.js-add-to-cart.miglog-btn-add').first();
  if (await btn.count() > 0 && await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(1200);
    page.off('request', handler);
    return { status: 'added', cartRequest: cartRequestFired };
  }

  page.off('request', handler);
  return { status: 'no_button' };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Login
  console.log('🔐 מתחבר...');
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('#j_username', config.credentials.email);
  await page.fill('#j_password', config.credentials.password);
  await page.click('.btn-login.btn-big');
  await page.waitForTimeout(3000);

  const loggedIn = await page.evaluate(() => document.body.innerText.includes('יותם'));
  console.log(loggedIn ? '✅ מחובר!' : '⚠️ ייתכן בעיה');

  // Test with one item first
  console.log('\n🧪 בדיקה עם חלב...');
  const test = await addItem(page, 'חלב בקרטון 3% שומן');
  console.log('תוצאה:', test);

  // Verify in cart
  await page.goto('https://www.shufersal.co.il/online/he/cart', { waitUntil: 'networkidle', timeout: 20000 });
  const cartCount = await page.evaluate(() => {
    const items = document.querySelectorAll('.cartItem, .cart-item, [data-product-code]');
    return items.length;
  });
  console.log('פריטים בסל:', cartCount);

  if (cartCount === 0 && !test.cartRequest) {
    // Maybe need to select delivery time first
    console.log('\nאולי צריך לבחור זמן משלוח קודם...');
    const switchBtn = page.locator('.js-delivery-modal-opener, .switchBtn').first();
    if (await switchBtn.count() > 0) {
      await switchBtn.click();
      await page.waitForTimeout(2000);
      // Select first delivery slot
      const slot = page.locator('.timeSlot:not(.disabled), .slot-item:not(.disabled)').first();
      if (await slot.count() > 0) {
        await slot.click();
        await page.waitForTimeout(1000);
        console.log('✅ בחרתי זמן משלוח');
      }
    }

    // Try again
    const test2 = await addItem(page, 'חלב בקרטון 3% שומן');
    console.log('תוצאה אחרי בחירת משלוח:', test2);
  }

  if (cartCount === 0) {
    console.log('\n❌ עדיין לא עובד. מפסיק.');
    await browser.close();
    return;
  }

  console.log('\n✅ עובד! ממשיך עם כל הפריטים...');

  const results = [{ name: 'חלב בקרטון 3% שומן', status: 'added' }];
  let added = 1, failed = 0;

  for (const item of basket.items.slice(1)) {
    console.log(`[${added + failed + 2}/${basket.items.length}] ${item.name}`);
    const r = await addItem(page, item.name);
    if (r.status === 'added') {
      process.stdout.write('  ✅\n');
      results.push({ name: item.name, status: 'added' });
      added++;
    } else {
      process.stdout.write(`  ❌ (${r.status})\n`);
      results.push({ name: item.name, status: r.status });
      failed++;
    }
  }

  await browser.close();
  console.log(`\n📋 ${added}/${basket.items.length} נוספו`);
  fs.writeFileSync('./data/cart_build_results.json', JSON.stringify(results, null, 2));
})();
