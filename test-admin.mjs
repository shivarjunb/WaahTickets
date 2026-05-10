import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text(), msg.location().url, msg.location().lineNumber));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.stack));
  
  await page.goto('http://127.0.0.1:5173/admin', { waitUntil: 'networkidle0' });
  
  await browser.close();
})();
