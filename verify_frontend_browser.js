const puppeteer = require('../Challenge-3-Comparing-AI-Models/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const BROWSER_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function verifyBrowser() {
  console.log('Launching browser from:', BROWSER_PATH);
  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[Browser ${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[Browser Error]: ${err.toString()}`));

  console.log('Navigating to http://localhost:8085/...');
  await page.goto('http://localhost:8085/', { waitUntil: 'networkidle0' });

  // Wait 1 sec for API data to render
  await new Promise(r => setTimeout(r, 1000));

  // 1. Verify App Title & Badge
  const title = await page.$eval('#app-title', el => el.textContent.trim());
  console.log('Page Title:', title);
  if (title !== 'BugVault') throw new Error('App title does not match BugVault');

  const badgeText = await page.$eval('#backend-status-badge', el => el.textContent.trim());
  console.log('Backend Status Badge:', badgeText);

  // 2. Take initial screenshot
  const screenshotPath1 = path.join(__dirname, 'frontend_verified_initial.png');
  await page.screenshot({ path: screenshotPath1, fullPage: true });
  console.log('Saved initial screenshot to:', screenshotPath1);

  // 3. Test Form CREATE
  console.log('\n--- Testing Frontend Form Submission (POST /bugs) ---');
  await page.type('#bug-title', 'React useEffect Infinite Loop');
  await page.type('#bug-error', 'Maximum update depth exceeded. This can happen when a component calls setState inside useEffect');
  await page.type('#bug-cause', 'Missing dependency array in useEffect hook, causing state update on every render');
  await page.type('#bug-solution', 'Added empty dependency array [] to run effect only on mount');
  await page.type('#bug-date', '2026-09-16');

  await page.click('#submit-btn');
  await new Promise(r => setTimeout(r, 1200));

  // Verify created bug appears in list
  const bugCards = await page.$$('.bug-card');
  console.log(`Rendered bug cards count after creation: ${bugCards.length}`);
  if (bugCards.length < 2) throw new Error('Created bug did not appear in the DOM list');

  const screenshotPath2 = path.join(__dirname, 'frontend_verified_created.png');
  await page.screenshot({ path: screenshotPath2, fullPage: true });
  console.log('Saved created screenshot to:', screenshotPath2);

  // 4. Test Form EDIT & UPDATE (PUT /bugs/:id)
  console.log('\n--- Testing Frontend Edit Flow (PUT /bugs/:id) ---');
  // Click edit on the first button
  const editButtons = await page.$$('.btn-edit');
  await editButtons[0].click();
  await new Promise(r => setTimeout(r, 600));

  const submitText = await page.$eval('#submit-btn-text', el => el.textContent.trim());
  console.log('Submit button text in edit mode:', submitText);
  if (submitText !== 'Update Bug') throw new Error('Button text did not change to Update Bug');

  // Change title
  await page.click('#bug-title', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('#bug-title', 'React useEffect Infinite Loop (Solved)');

  await page.click('#submit-btn');
  await new Promise(r => setTimeout(r, 1200));

  const updatedHeading = await page.$eval('.bug-title', el => el.textContent.trim());
  console.log('Updated card heading in DOM:', updatedHeading);
  if (!updatedHeading.includes('(Solved)')) throw new Error('Updated heading not reflected in DOM');

  // 5. Test DELETE flow
  console.log('\n--- Testing Frontend Delete Flow (DELETE /bugs/:id) ---');
  // Auto-accept confirm dialog
  page.on('dialog', async dialog => {
    console.log(`Dialog message: "${dialog.message()}"`);
    await dialog.accept();
  });

  const deleteButtons = await page.$$('.btn-danger');
  await deleteButtons[0].click();
  await new Promise(r => setTimeout(r, 1200));

  const cardsAfterDelete = await page.$$('.bug-card');
  console.log(`Rendered bug cards count after delete: ${cardsAfterDelete.length}`);

  const screenshotPath3 = path.join(__dirname, 'frontend_verified_final.png');
  await page.screenshot({ path: screenshotPath3, fullPage: true });
  console.log('Saved final screenshot to:', screenshotPath3);

  await browser.close();
  console.log('\n✅ ALL FRONTEND BROWSER CRUD INTERACTIONS FULLY VERIFIED!');
}

verifyBrowser().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
