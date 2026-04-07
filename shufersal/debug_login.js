const { chromium } = require('playwright');
const config = require('./config.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })).newPage();

  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).map(el => ({
      id: el.id, name: el.name, type: el.type,
      placeholder: el.placeholder, visible: el.offsetParent !== null,
      cls: el.className.substring(0, 60)
    }))
  );
  console.log('INPUTS:', JSON.stringify(inputs, null, 2));

  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(el => ({
      text: el.textContent.trim().substring(0, 40),
      type: el.type, id: el.id, cls: el.className.substring(0, 60)
    }))
  );
  console.log('BUTTONS:', JSON.stringify(btns, null, 2));

  // Try to login
  console.log('\n--- ניסיון כניסה ---');
  const emailField = inputs.find(i => i.type === 'email' || i.name.includes('mail') || i.id.includes('mail'));
  const passField = inputs.find(i => i.type === 'password');
  console.log('Email field:', emailField);
  console.log('Password field:', passField);

  if (emailField) {
    const sel = emailField.id ? `#${emailField.id}` : `input[name="${emailField.name}"]`;
    await page.fill(sel, config.credentials.email);
    console.log('✅ מילאתי אימייל ב-', sel);
  }
  if (passField) {
    const sel = passField.id ? `#${passField.id}` : `input[type="password"]`;
    await page.fill(sel, config.credentials.password);
    console.log('✅ מילאתי סיסמה ב-', sel);
  }

  // Click submit
  const submitBtn = btns.find(b => b.type === 'submit' || b.text.includes('כניסה') || b.text.includes('login'));
  if (submitBtn) {
    const sel = submitBtn.id ? `#${submitBtn.id}` : `button[type="submit"]`;
    await page.click(sel);
    console.log('✅ לחצתי על:', sel);
  }

  await page.waitForTimeout(3000);
  console.log('URL אחרי כניסה:', page.url());

  // Check if logged in
  const loggedIn = await page.evaluate(() => {
    return !!document.querySelector('.user-name, .logout, [href*="logout"], .account-name');
  });
  console.log('מחובר?', loggedIn);

  await browser.close();
})();
