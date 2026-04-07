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
  'סוכריות מנטה לל"ס': "מנטה לל\"ס",
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

  // Step 1: Login properly
  console.log('🔐 מתחבר...');
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Wait for login form to be visible
  try {
    await page.waitForSelector('#j_email', { state: 'visible', timeout: 10000 });
    await page.fill('#j_email', config.credentials.email);
    await page.fill('#j_password', config.credentials.password);
    await page.click('.loginFormButton, button[type="submit"]');
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const url = page.url();
    console.log('URL אחרי כניסה:', url);

    // Verify logged in
    const loggedIn = await page.$('.user-name, .logout, [data-action="logout"], .my-account') !== null;
    console.log(loggedIn ? '✅ מחובר' : '⚠️ ייתכן שהכניסה לא הצליחה, ממשיך בכל זאת');
  } catch (e) {
    console.log('⚠️ בעיה בכניסה:', e.message.split('\n')[0]);
  }

  const results = [];
  let added = 0, failed = 0;

  for (const item of basket.items) {
    const query = searchQueries[item.name] || item.name;
    const idx = added + failed + 1;
    console.log(`\n[${idx}/${basket.items.length}] ${item.name}`);

    try {
      await page.goto(
        `https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(query)}`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      );
      await page.waitForTimeout(1200);

      // Try multiple selectors for add-to-cart
      const btnSelectors = [
        'button.addToCart',
        '.add-to-cart-btn',
        '[data-gtm-action="addToCart"]',
        'button[data-action="add"]',
        '.js-add-item',
        '.addToCart',
        'button.js-add-item',
      ];

      let clicked = false;
      for (const sel of btnSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(800);
          clicked = true;
          break;
        }
      }

      if (clicked) {
        console.log('  ✅');
        results.push({ name: item.name, status: 'added' });
        added++;
      } else {
        console.log('  ❌ לא נמצא כפתור');
        results.push({ name: item.name, status: 'not_found' });
        failed++;
      }
    } catch (e) {
      console.log('  ❌ שגיאה:', e.message.split('\n')[0]);
      results.push({ name: item.name, status: 'error' });
      failed++;
    }
  }

  await browser.close();

  console.log(`\n\n📋 סיכום: ${added}/${basket.items.length} נוספו`);
  const failedItems = results.filter(r => r.status !== 'added');
  if (failedItems.length > 0) {
    console.log('\n❌ נכשלו:');
    failedItems.forEach(r => console.log(' -', r.name));
  }

  fs.writeFileSync('./data/cart_build_results.json', JSON.stringify(results, null, 2));
})();
