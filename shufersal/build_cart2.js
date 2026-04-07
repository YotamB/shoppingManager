const { chromium } = require('playwright');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Only remaining items (first 5 already added)
const ITEMS = [
  'קלינקס לושן 3 שכבות 120',
  'גרעיני תירס לפופקורן',
  'סוויטאנגו 280 גרם',
  'תרסיס מסיר כתמים XPO',
  "ג'ל מסיר כתמים צבעוני XPO 3 ליטר",
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
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);

  try {
    await page.fill('input[type="email"], input[name="j_username"], #loginEmail', config.credentials.email);
    await page.fill('input[type="password"], input[name="j_password"], #loginPassword', config.credentials.password);
    await page.click('button[type="submit"], .login-btn, #loginBtn');
    await page.waitForTimeout(2000);
    console.log('✅ התחברתי');
  } catch (e) {
    console.log('⚠️ בעיה בכניסה:', e.message);
  }

  for (const item of ITEMS) {
    console.log(`\n🔍 ${item}`);
    try {
      const searchUrl = `https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(item)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      const addBtn = page.locator('.addToCart, .add-to-cart, [data-action="add"], button.js-add-item').first();
      if (await addBtn.count() > 0) {
        await addBtn.click();
        await page.waitForTimeout(1000);
        console.log(`  ✅ נוסף`);
        results.push({ item, status: 'added' });
      } else {
        console.log(`  ❌ לא נמצא כפתור`);
        results.push({ item, status: 'not_found' });
      }
    } catch (e) {
      console.log(`  ❌ שגיאה: ${e.message}`);
      results.push({ item, status: 'error', error: e.message });
    }
  }

  await browser.close();

  console.log('\n📋 סיכום:');
  for (const r of results) {
    console.log(`${r.status === 'added' ? '✅' : '❌'} ${r.item}`);
  }

  // Merge with previous results
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync('./data/cart_build_results.json')); } catch(e) {}
  fs.writeFileSync('./data/cart_build_results.json', JSON.stringify([...prev, ...results], null, 2));
})();
