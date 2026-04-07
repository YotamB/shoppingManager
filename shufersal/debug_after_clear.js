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
  console.log('מחובר:', (await page.evaluate(() => document.body.innerText)).includes('יותם'));

  // Go to search and check what button.js-add-to-cart looks like now
  await page.goto('https://www.shufersal.co.il/online/he/search?q=חלב+בקרטון', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button.js-add-to-cart')).slice(0, 3).map(b => ({
      cls: b.className,
      visible: b.offsetParent !== null,
      disabled: b.disabled,
      text: b.textContent.trim().substring(0, 30),
      parentCls: b.parentElement?.className?.substring(0, 50)
    }))
  );
  console.log('js-add-to-cart buttons:', JSON.stringify(btns, null, 2));

  // Also check if there's a delivery time needed
  const deliveryNeeded = await page.evaluate(() => {
    return !!document.querySelector('.js-delivery-modal-opener, .no-delivery-slot');
  });
  console.log('צריך לבחור משלוח?', deliveryNeeded);

  // Check page title / any block message
  const title = await page.title();
  const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('Title:', title);
  console.log('Body:', bodySnippet);

  await browser.close();
})();
