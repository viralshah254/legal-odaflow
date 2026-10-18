import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://localhost:3000/solutions', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/solutions-top.png' });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/solutions-bottom.png' });

// pillar page - get first slug
await page.goto('http://localhost:3000/solutions/legal-research', { waitUntil: 'networkidle' }).catch(async () => {
  await page.goto('http://localhost:3000/solutions', { waitUntil: 'networkidle' });
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/pillar-top.png' });
await browser.close();
console.log('done');
