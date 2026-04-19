const puppeteer = require('puppeteer');
const path = require('path');

const pages = [
  { file: 'social-1.html', output: 'gwv-spring-camp-announcement.png', width: 1080, height: 1080 },
  { file: 'social-2.html', output: 'gwv-spring-camp-dates.png', width: 1080, height: 1080 },
  { file: 'social-3.html', output: 'gwv-spring-camp-takeaways.png', width: 1080, height: 1350 },
  { file: 'social-4.html', output: 'gwv-spring-camp-schedule.png', width: 1200, height: 630 },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const page of pages) {
    const tab = await browser.newPage();
    await tab.setViewport({ width: page.width, height: page.height, deviceScaleFactor: 2 });

    const filePath = 'file://' + path.resolve(__dirname, page.file);
    await tab.goto(filePath, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for fonts to load
    await tab.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 1000));

    const outputPath = path.resolve(__dirname, page.output);
    await tab.screenshot({
      path: outputPath,
      type: 'png',
      clip: { x: 0, y: 0, width: page.width, height: page.height }
    });

    console.log(`✅ ${page.output} (${page.width}x${page.height})`);
    await tab.close();
  }

  await browser.close();
  console.log('\nDone! All 4 PNGs saved to social/');
})();
