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
  await page.goto(
    `https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(query)}`,
    { waitUntil: 'networkidle', timeout: 25000 }
  );

  // Wait for product results to load
  try {
    await page.waitForSelector('.miglog-prod, .productWrapper, [data-product-id]', { timeout: 8000 });
  } catch (e) {
    return { status: 'no_products' };
  }

  // Find add-to-cart button on first product
  const selectors = [
    '.miglog-prod:first-child button.addToCart',
    '.productWrapper:first-child button.addToCart',
    'li.productWrapper:first-child .addToCart',
    '.addToCart',
    'button[data-gtm-action="addToCart"]',
  ];

  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0) {
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        await btn.click();
        await page.waitForTimeout(600);
        return { status: 'added', selector: sel };
      }
    }
  }

  // Log what buttons exist for debugging
  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter(b => b.offsetParent !== null)
      .map(b => b.className.substring(0, 60))
  );
  return { status: 'no_button', visibleButtons: btns.slice(0, 10) };
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

  const loggedIn = await page.evaluate(() => document.body.innerText.includes('יותם') || document.body.innerText.includes('יוטם'));
  console.log(loggedIn ? '✅ מחובר!' : '⚠️ לא בטוח...');

  // Test one item first
  console.log('\n🧪 בדיקה עם פריט אחד...');
  const testResult = await addItem(page, 'חלב בקרטון 3% שומן');
  console.log('תוצאת בדיקה:', JSON.stringify(testResult, null, 2));

  if (testResult.status === 'no_button') {
    console.log('\n❌ כפתור הוסף לסל לא נמצא! בודק את המבנה...');
    await page.goto('https://www.shufersal.co.il/online/he/search?q=חלב', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    const html = await page.evaluate(() => {
      const prod = document.querySelector('.miglog-prod, .productWrapper, [data-product-id]');
      return prod ? prod.innerHTML.substring(0, 1000) : 'לא נמצא';
    });
    console.log('HTML מוצר ראשון:', html);
    await browser.close();
    return;
  }

  // Check cart after test
  await page.goto('https://www.shufersal.co.il/online/he/cart', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  const cartItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.product-name, .miglog-cart-item-name, .cartItem .name'))
      .map(el => el.textContent.trim())
  );
  console.log('פריטים בסל אחרי בדיקה:', cartItems);

  if (cartItems.length === 0) {
    console.log('❌ הסל עדיין ריק אחרי הוספה — הכפתור לא עובד כמצופה');
    await browser.close();
    return;
  }

  console.log('\n✅ כפתור עובד! ממשיך עם שאר הפריטים...');

  const results = [{ name: 'חלב בקרטון 3% שומן', status: 'added' }];
  let added = 1, failed = 0;

  for (const item of basket.items.slice(1)) {
    console.log(`[${added + failed + 2}/${basket.items.length}] ${item.name}`);
    const result = await addItem(page, item.name);
    if (result.status === 'added') {
      process.stdout.write('  ✅\n');
      results.push({ name: item.name, status: 'added' });
      added++;
    } else {
      process.stdout.write(`  ❌ (${result.status})\n`);
      results.push({ name: item.name, status: result.status });
      failed++;
    }
  }

  await browser.close();
  console.log(`\n📋 ${added}/${basket.items.length} נוספו`);
  fs.writeFileSync('./data/cart_build_results.json', JSON.stringify(results, null, 2));
})();
