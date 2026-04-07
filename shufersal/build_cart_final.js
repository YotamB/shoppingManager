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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Login with correct selectors
  console.log('🔐 מתחבר...');
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('#j_username', config.credentials.email);
  await page.fill('#j_password', config.credentials.password);
  await page.click('.btn-login.btn-big');
  await page.waitForTimeout(3000);

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 100));
  if (bodyText.includes('יותם') || bodyText.includes('יוטם')) {
    console.log('✅ מחובר!');
  } else {
    console.log('⚠️ לא בטוח שמחובר, ממשיך בכל זאת...');
  }

  const results = [];
  let added = 0, failed = 0;

  for (const item of basket.items) {
    const query = searchQueries[item.name] || item.name;
    console.log(`[${added + failed + 1}/${basket.items.length}] ${item.name}`);
    try {
      await page.goto(
        `https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(query)}`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      );
      await page.waitForTimeout(1000);

      const btnSelectors = [
        'button.addToCart',
        '.addToCart',
        '.add-to-cart-btn',
        '[data-gtm-action="addToCart"]',
        'button.js-add-item',
        '.js-add-item',
      ];

      let clicked = false;
      for (const sel of btnSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(700);
          clicked = true;
          break;
        }
      }

      if (clicked) {
        process.stdout.write('  ✅\n');
        results.push({ name: item.name, status: 'added' });
        added++;
      } else {
        process.stdout.write('  ❌\n');
        results.push({ name: item.name, status: 'not_found' });
        failed++;
      }
    } catch (e) {
      process.stdout.write('  ❌\n');
      results.push({ name: item.name, status: 'error' });
      failed++;
    }
  }

  await browser.close();

  console.log(`\n📋 ${added}/${basket.items.length} נוספו`);
  if (failed > 0) {
    console.log('נכשלו:');
    results.filter(r => r.status !== 'added').forEach(r => console.log(' -', r.name));
  }

  fs.writeFileSync('./data/cart_build_results.json', JSON.stringify(results, null, 2));
})();
