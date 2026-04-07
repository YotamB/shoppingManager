const { chromium } = require('playwright');
const config = require('./config.json');

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

  const name = await page.evaluate(() => {
    const el = document.querySelector('.user-name, .top-account .name, .js-user-name');
    return el ? el.textContent.trim() : null;
  });
  console.log('שם משתמש:', name || 'לא נמצא');

  // Check cart before
  const cartBefore = await page.evaluate(() => {
    const el = document.querySelector('.js-cart-count, .cart-count, [data-cart-count]');
    return el ? el.textContent.trim() : '?';
  });
  console.log('פריטים בסל לפני:', cartBefore);

  // Add one item
  console.log('\nמוסיף חלב...');
  await page.goto('https://www.shufersal.co.il/online/he/search?q=חלב+בקרטון+3%25', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);

  // Dump all button selectors
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).slice(0, 20).map(b => ({
      cls: b.className.substring(0, 80),
      text: b.textContent.trim().substring(0, 30),
      visible: b.offsetParent !== null,
      dataAction: b.getAttribute('data-action'),
      id: b.id
    }))
  );
  console.log('כפתורים בדף חיפוש:', JSON.stringify(buttons.filter(b => b.visible), null, 2));

  // Try clicking
  const addBtn = page.locator('button.addToCart, .addToCart, button[data-gtm-action="addToCart"]').first();
  if (await addBtn.count() > 0) {
    await addBtn.click();
    await page.waitForTimeout(1500);
    console.log('✅ לחצתי על הוסף');
  } else {
    console.log('❌ לא נמצא כפתור הוסף');
  }

  // Check cart after
  await page.goto('https://www.shufersal.co.il/online/he/cart', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  const cartText = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log('\nסל אחרי הוספה:\n', cartText);

  await browser.close();
})();
