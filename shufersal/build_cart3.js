const { chromium } = require('playwright');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const ITEMS = [
  // From history
  { query: 'סוכריות מנטה לל"ס', hint: 'סוכריות מנטה לל"ס' },
  { query: 'ביצי הפתעה קינדר', hint: 'קינדר' },
  { query: 'תמר מג\'הול אורגני', hint: 'תמר' },
  { query: 'אל סבון לילדים', hint: 'אל סבון' },
  { query: 'גבינת בייבי בל', hint: 'בייבי בל' },
  { query: 'סנו ג\'אוול לימון', hint: "ג'אוול" },
  // Soaps - search each specifically
  { query: 'סבון מוצק אובליפיחה שביט', hint: 'שביט' },
  { query: 'עץ התה סבון מוצק שביט', hint: 'שביט' },
  { query: 'סבון נסטי ליפט', hint: 'נסטי' },
  { query: 'סבון אורגני פטל סרפד נסטי', hint: 'נסטי' },
  { query: 'סבון אורגני ארגן חציר נסטי', hint: 'נסטי' },
  // Shampoo
  { query: 'שמפו דאב 400', hint: 'דאב' },
];

const results = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  console.log('🔐 מתחבר...');
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  try {
    await page.fill('input[type="email"], #loginEmail', config.credentials.email);
    await page.fill('input[type="password"], #loginPassword', config.credentials.password);
    await page.click('button[type="submit"], #loginBtn');
    await page.waitForTimeout(2000);
    console.log('✅ התחברתי');
  } catch (e) {
    console.log('⚠️ בעיה:', e.message);
  }

  for (const item of ITEMS) {
    console.log(`\n🔍 ${item.hint}`);
    try {
      await page.goto(`https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(item.query)}`, {
        waitUntil: 'domcontentloaded', timeout: 15000
      });
      await page.waitForTimeout(1200);

      const addBtn = page.locator('.addToCart, .add-to-cart, [data-action="add"], button.js-add-item').first();
      if (await addBtn.count() > 0) {
        await addBtn.click();
        await page.waitForTimeout(800);
        console.log(`  ✅ נוסף`);
        results.push({ item: item.hint, status: 'added' });
      } else {
        console.log(`  ❌ לא נמצא`);
        results.push({ item: item.hint, status: 'not_found' });
      }
    } catch (e) {
      console.log(`  ❌ שגיאה: ${e.message}`);
      results.push({ item: item.hint, status: 'error' });
    }
  }

  await browser.close();

  console.log('\n📋 סיכום:');
  for (const r of results) {
    console.log(`${r.status === 'added' ? '✅' : '❌'} ${r.item}`);
  }

  let prev = [];
  try { prev = JSON.parse(fs.readFileSync('./data/cart_build_results.json')); } catch(e) {}
  fs.writeFileSync('./data/cart_build_results.json', JSON.stringify([...prev, ...results], null, 2));
})();
