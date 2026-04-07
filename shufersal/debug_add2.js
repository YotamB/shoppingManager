const { chromium } = require('playwright');
const config = require('./config.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })).newPage();

  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('#j_username', config.credentials.email);
  await page.fill('#j_password', config.credentials.password);
  await page.click('.btn-login.btn-big');
  await page.waitForTimeout(3000);

  // Intercept ALL requests to understand what's happening
  let requests = [];
  page.on('request', req => requests.push({ method: req.method(), url: req.url().substring(0, 100) }));

  await page.goto('https://www.shufersal.co.il/online/he/search?q=חלב+בקרטון+3%25', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Does button.js-add-to-cart exist at all?
  const count = await page.evaluate(() => document.querySelectorAll('button.js-add-to-cart').length);
  console.log('כמות כפתורי js-add-to-cart:', count);

  // JS click on first one
  requests = [];
  const result = await page.evaluate(() => {
    const btn = document.querySelector('button.js-add-to-cart');
    if (!btn) return 'NO BUTTON';
    btn.click();
    return `clicked: ${btn.textContent.trim().substring(0, 30)}`;
  });
  console.log('תוצאה:', result);
  await page.waitForTimeout(2000);

  const cartRequests = requests.filter(r => r.url.includes('cart'));
  console.log('cart requests:', cartRequests);

  // Check if cart updated
  const cartCount = await page.evaluate(() => {
    const el = document.querySelector('.cartIcon .counter, .js-cart-count, .qty-in-cart');
    return el ? el.textContent.trim() : 'NOT FOUND';
  });
  console.log('Cart counter:', cartCount);

  // Check cart page
  await page.goto('https://www.shufersal.co.il/online/he/cart', { waitUntil: 'networkidle', timeout: 20000 });
  const cartItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-product-code], .cartItem')).map(el =>
      el.getAttribute('data-product-code') || el.querySelector('.name')?.textContent?.trim()
    ).filter(Boolean)
  );
  console.log('פריטים בסל:', cartItems.length, cartItems.slice(0, 5));

  await browser.close();
})();
