const { chromium } = require('playwright');
const config = require('./config.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })).newPage();

  await page.goto('https://www.shufersal.co.il/online/he/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // The username field j_username (text type) is visible — use that one instead of j_email
  // j_username is the main login (phone/email/username)
  console.log('מנסה כניסה עם j_username...');
  
  try {
    await page.fill('#j_username', config.credentials.email);
    await page.fill('#j_password', config.credentials.password);
    console.log('✅ מילאתי שדות');
    
    await page.click('.btn-login.btn-big');
    await page.waitForTimeout(4000);
    console.log('URL:', page.url());
    
    // Check login
    const loggedIn = await page.evaluate(() => {
      return !!document.querySelector('.user-name, .top-account, .js-my-account, [data-loggedin]');
    });
    console.log('מחובר?', loggedIn);
    
    // Also check page source for user indication
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('Body preview:', bodyText);
    
  } catch (e) {
    console.log('שגיאה:', e.message.split('\n')[0]);
  }

  await browser.close();
})();
