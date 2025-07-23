#!/usr/bin/env tsx

import puppeteer from 'puppeteer-core';

async function smokePuppeteerTest() {
  console.log('🧪 Running Puppeteer-Core smoke test...');
  
  let browser;
  try {
    // Use system Chrome/Chromium - try multiple possible paths
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/usr/bin/chromium-browser', // Alpine/Linux
      '/usr/bin/chromium',         // Ubuntu/Debian  
      '/usr/bin/google-chrome',    // Ubuntu/Debian
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/Applications/Chromium.app/Contents/MacOS/Chromium', // macOS Chromium
    ].filter(Boolean);
    
    let executablePath = possiblePaths[0];
    
    // Try to find an existing Chrome installation
    for (const path of possiblePaths) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(path!)) {
          executablePath = path;
          break;
        }
      } catch (e: unknown) {
        // Continue trying other paths
      }
    }
    
    console.log(`🚀 Launching browser at: ${executablePath}`);
    
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    });

    const page = await browser.newPage();
    
    console.log('📄 Creating test page...');
    await page.goto('data:text/html,<h1>Puppeteer-Core Test</h1><p>Success!</p>');
    
    const title = await page.title();
    console.log(`📰 Page title: ${title}`);
    
    const heading = await page.$eval('h1', el => el.textContent);
    console.log(`🎯 Found heading: ${heading}`);
    
    if (heading !== 'Puppeteer-Core Test') {
      throw new Error('Unexpected heading content');
    }
    
    console.log('✅ Puppeteer-Core smoke test PASSED');
    
  } catch (error) {
    console.error('❌ Puppeteer-Core smoke test FAILED:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  smokePuppeteerTest();
}

export default smokePuppeteerTest; 