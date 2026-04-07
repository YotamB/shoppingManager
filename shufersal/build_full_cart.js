const { chromium } = require('playwright');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const basket = JSON.parse(fs.readFileSync('./data/saved_basket.json', 'utf8'));

// Map item names to search queries
const searchQueries = {
  "חלב בקרטון 3% שומן": "חלב בקרטון 3% שומן",
  "קפסולות Starbucks האוס": "קפסולות Starbucks האוס",
  "מרכך כביסה מרוכז BREEZ": "מרכך כביסה מרוכז BREEZ",
  "אבקת כביסה סנסטיב": "אבקת כביסה סנסטיב",
  "מגבונים לחים מארז ענק": "מגבונים לחים מארז ענק",
  "קלינקס לושן 3 שכבות 120 יח'": "קלינקס לושן 3 שכבות 120",
  "גרעיני תירס לפופקורן": "גרעיני תירס לפופקורן",
  "סוויטאנגו 280 גרם": "סוויטאנגו 280",
  "תרסיס מסיר כתמים XPO": "תרסיס מסיר כתמים XPO",
  "ג'ל מסיר כתמים צבעוני XPO 3 ליטר": "ג'ל מסיר כתמים צבעוני XPO 3 ליטר",
  "מסיר כתמים קשים Lu": "מסיר כתמים קשים Lu",
  "שקיות אשפה XL חזקות XPO": "שקיות אשפה XL חזקות XPO",
  'סוכריות מנטה לל"ס': 'סוכריות מנטה לל"ס',
  "ביצי הפתעה קינדר": "ביצי הפתעה קינדר",
  "תמר מג'הול אורגני": "תמר מג'הול אורגני",
  "אל סבון לילדים": "אל סבון לילדים",
  "גבינת בייבי בל": "גבינת בייבי בל",
  "סנו ג'אוול לימון": "סנו ג'אוול לימון",
  "סבון מוצק אובליפיחה - שביט": "סבון מוצק אובליפיחה שביט",
  "עץ התה סבון מוצק - שביט": "עץ התה סבון מוצק שביט",
  "סבון נסטי ליפט": "סבון נסטי ליפט",
  "סבון אורגני פטל וסרפד - נסטי": "סבון אורגני פטל סרפד נסטי",
  "סבון אורגני ארגן וחציר - נסטי": "סבון אורגני ארגן חציר נסטי",
  'שמפו דאב 400מ"ל': "שמפו דאב 400",
  "Muller Droop לימון": "יוגורט פרופ קציפת לימון מולר",
  "Muller Droop אפרסק פסיפלורה": "יוגורט פרופ קציפת אפרסק פסיפלורה מולר",
  "Muller Droop פירות יער": "יוגורט פרופ קציפת פירות יער מולר",
  "Muller Droop תות": "יוגורט פרופ קציפת תות מולר",
  "Muller Droop פטל": "יוגורט פרופ קציפת פטל מולר",
  "מולר יוגורט אפרסק 3%": "יוגורט אפרסק 3% שומן מולר",
  "מולר יוגורט תות 3%": "יוגורט תות 3% שומן מולר",
  "מולר יוגורט קיווי 3%": "יוגורט קיווי 3% שומן מולר",
  "מולר יוגורט מנגו 3%": "יוגורט מנגו 3% שומן מולר",
  "מולר יוגורט פירות יער 3%": "יוגורט פירות יער 3% שומן מולר",
  "לאבנה פיראוס 5%": "לאבנה פיראוס 5%",
};

const results = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Login
  console.log('🔐 מתחבר...');
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  try {
    await page.fill('#j_email', config.credentials.email, { timeout: 5000 });
    await page.fill('input[type="password"]', config.credentials.password, { timeout: 5000 });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    console.log('✅ התחברתי');
  } catch (e) {
    console.log('ℹ️ ממשיך (session קיים?)');
  }

  let added = 0, failed = 0;

  for (const item of basket.items) {
    const query = searchQueries[item.name] || item.name;
    console.log(`\n[${added + failed + 1}/${basket.items.length}] ${item.name}`);
    try {
      await page.goto(`https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(query)}`, {
        waitUntil: 'domcontentloaded', timeout: 15000
      });
      await page.waitForTimeout(900);

      const btn = page.locator('.addToCart, .add-to-cart, [data-action="add"], button.js-add-item').first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(700);
        console.log(`  ✅`);
        results.push({ name: item.name, status: 'added' });
        added++;
      } else {
        console.log(`  ❌ לא נמצא`);
        results.push({ name: item.name, status: 'not_found' });
        failed++;
      }
    } catch (e) {
      console.log(`  ❌ שגיאה`);
      results.push({ name: item.name, status: 'error' });
      failed++;
    }
  }

  await browser.close();

  console.log(`\n\n📋 סיכום: ${added} נוספו, ${failed} נכשלו`);
  for (const r of results) {
    console.log(`${r.status === 'added' ? '✅' : '❌'} ${r.name}`);
  }

  fs.writeFileSync('./data/cart_build_results.json', JSON.stringify(results, null, 2));
})();
