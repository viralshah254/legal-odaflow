import { chromium } from 'playwright';
const browser = await chromium.launch();

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto('http://localhost:3000/for-lawyers', { waitUntil: 'networkidle' });
await desktop.waitForTimeout(1000);
await desktop.screenshot({ path: '/tmp/for-lawyers-desktop-top.png' });
await desktop.evaluate(() => window.scrollBy(0, 900));
await desktop.waitForTimeout(500);
await desktop.screenshot({ path: '/tmp/for-lawyers-desktop-2.png' });
await desktop.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await desktop.waitForTimeout(500);
await desktop.screenshot({ path: '/tmp/for-lawyers-desktop-bottom.png' });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await mobile.goto('http://localhost:3000/for-lawyers', { waitUntil: 'networkidle' });
await mobile.waitForTimeout(1000);
await mobile.screenshot({ path: '/tmp/for-lawyers-mobile-top.png' });

await browser.close();
console.log('done');
