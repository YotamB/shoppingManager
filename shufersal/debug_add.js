const { chromium } = require('playwright');
const config = require('./config.json');

(async () => {
  const browser = await chromium.launch({ headless: false }); // headful to see what happens
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Login
  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('#j_username', config.credentials.email);
  await page.fill('#j_password', config.credentials.password);
  await page.click('.btn-login.btn-big');
  await page.waitForTimeout(3000);
  console.log('מחובר?', (await page.evaluate(() => document.body.innerText)).includes('יותם'));

  // Search
  await page.goto('https://www.shufersal.co.il/online/he/search?q=חלב+בקרטון+3%25', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3000);

  // Dump first product HTML
  const prodHtml = await page.evaluate(() => {
    const p = document.querySelector('.miglog-prod, .productWrapper, [data-product-id], .product-item');
    return p ? p.outerHTML.substring(0, 2000) : 'NO PRODUCT FOUND';
  });
  console.log('Product HTML:\n', prodHtml);

  // Find the add button details
  const btnDetails = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
      .filter(b => b.className.includes('add') || b.className.includes('cart') || b.className.includes('Add'))
      .map(b => ({
        cls: b.className,
        text: b.textContent.trim().substring(0, 30),
        visible: b.offsetParent !== null,
        dataAction: b.dataset.action,
        dataCode: b.dataset.code || b.dataset.productCode,
        onclick: b.onclick ? 'has onclick' : null,
        parentCls: b.parentElement?.className?.substring(0, 50)
      }));
    return btns;
  });
  console.log('\nAdd buttons:', JSON.stringify(btnDetails, null, 2));

  // Intercept network requests when clicking add
  page.on('request', req => {
    if (req.url().includes('cart') || req.url().includes('add') || req.url().includes('product')) {
      console.log('REQUEST:', req.method(), req.url().substring(0, 150));
    }
  });

  page.on('response', async res => {
    if (res.url().includes('cart') || res.url().includes('add')) {
      console.log('RESPONSE:', res.status(), res.url().substring(0, 150));
    }
  });

  // Click the add button
  console.log('\nלוחץ על הוסף...');
  const btn = page.locator('.addToCart').first();
  await btn.click();
  await page.waitForTimeout(3000);

  // Check cart counter
  const cartCount = await page.evaluate(() => {
    const el = document.querySelector('.cart-count, .js-cart-count, .cartQuantity, [data-cart-count]');
    return el ? el.textContent.trim() : 'NOT FOUND';
  });
  console.log('Cart count after click:', cartCount);

  await browser.close();
})();
