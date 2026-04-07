const { chromium } = require('playwright');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const ITEMS = [
  // Muller Droop (פרופ קציפת) - 5 flavors
  { query: 'יוגורט פרופ קציפת לימון מולר', hint: 'Droop לימון' },
  { query: 'יוגורט פרופ קציפת אפרסק פסיפלורה מולר', hint: 'Droop אפרסק פסיפלורה' },
  { query: 'יוגורט פרופ קציפת פירות יער מולר', hint: 'Droop פירות יער' },
  { query: 'יוגורט פרופ קציפת תות מולר', hint: 'Droop תות' },
  { query: 'יוגורט פרופ קציפת פטל מולר', hint: 'Droop פטל' },
  // Muller regular - 5 flavors
  { query: 'יוגורט אפרסק 3% שומן מולר', hint: 'מולר אפרסק' },
  { query: 'יוגורט תות 3% שומן מולר', hint: 'מולר תות' },
  { query: 'יוגורט קיווי 3% שומן מולר', hint: 'מולר קיווי' },
  { query: 'יוגורט מנגו 3% שומן מולר', hint: 'מולר מנגו' },
  { query: 'יוגורט פירות יער 3% שומן מולר', hint: 'מולר פירות יער' },
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
    await page.fill('#j_email', config.credentials.email);
    await page.fill('input[type="password"]', config.credentials.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log('✅ התחברתי');
  } catch (e) {
    console.log('⚠️ ממשיך בלי כניסה מחדש:', e.message.split('\n')[0]);
  }

  for (const item of ITEMS) {
    console.log(`\n🔍 ${item.hint}`);
    try {
      await page.goto(`https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(item.query)}`, {
        waitUntil: 'domcontentloaded', timeout: 15000
      });
      await page.waitForTimeout(1000);

      const addBtn = page.locator('.addToCart, .add-to-cart, [data-action="add"], button.js-add-item').first();
      if (await addBtn.count() > 0) {
        await addBtn.click();
        await page.waitForTimeout(700);
        console.log(`  ✅ נוסף`);
        results.push({ item: item.hint, status: 'added' });
      } else {
        console.log(`  ❌ לא נמצא`);
        results.push({ item: item.hint, status: 'not_found' });
      }
    } catch (e) {
      console.log(`  ❌ שגיאה`);
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
