#!/usr/bin/env node
/**
 * Universal Zero-Interruption Headless Browser Visual Testing Engine
 * 
 * Features:
 * 1. 100% In-Memory Background Execution (--headless=new, zero focus stealing).
 * 2. Visual Regression & Pixel Diffing (pixelmatch + pngjs).
 * 3. Automated WCAG Accessibility Auditing (axe-core).
 * 4. Multi-Page Sitemap Crawling (--sitemap).
 * 5. Declarative YAML/JSON Test Scenarios (--scenario).
 * 6. Responsive Device Presets (Mobile, Tablet, Laptop, Desktop, 4K, --all-devices).
 * 7. Dual-Theme Support (Light & Dark mode verification).
 * 8. Automatic Tab Group Tagging & Session Isolation.
 * 9. Cross-Platform Windows, macOS, and Linux compatibility.
 */

const fs = require('fs');
const path = require('path');

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  try {
    puppeteer = require(path.join(__dirname, '../node_modules/puppeteer-core'));
  } catch (e2) {
    console.error('Error: puppeteer-core is required. Run: npm install puppeteer-core');
    process.exit(1);
  }
}

const { compareImages } = require('../lib/diff');
const { auditPage } = require('../lib/a11y');
const { parseSitemap } = require('../lib/sitemap');
const { loadScenario, executeScenario } = require('../lib/scenario');

// Cross-Platform Browser Discovery
function findChrome() {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || '';
    const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const winPaths = [
      path.join(progFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(progFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(progFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(progFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(localAppData, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(progFiles, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
      path.join(localAppData, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe')
    ];
    for (const p of winPaths) {
      if (p && fs.existsSync(p)) return p;
    }
  } else if (isMac) {
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/brave-browser',
      '/snap/bin/chromium'
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const chromePath = findChrome();
if (!chromePath) {
  console.error('Error: Google Chrome, Chromium, or Edge executable not found.');
  process.exit(1);
}

// Device Viewport Presets
const DEVICE_PRESETS = {
  desktop: { name: 'desktop', width: 1440, height: 960, scale: 2 },
  laptop: { name: 'laptop', width: 1280, height: 800, scale: 2 },
  tablet: { name: 'tablet', width: 768, height: 1024, scale: 2 },
  mobile: { name: 'mobile', width: 390, height: 844, scale: 3 }, // iPhone 14
  fullhd: { name: 'fullhd', width: 1920, height: 1080, scale: 2 },
  '4k': { name: '4k', width: 3840, height: 2160, scale: 1 }
};

// Parse CLI Flags
const args = process.argv.slice(2);
let urls = [];
let sitemapUrl = null;
let scenarioFile = null;
let outDir = process.env.ARTIFACT_DIR || process.cwd();
let baselineDir = null;
let doDiff = false;
let doA11y = false;
let preset = 'desktop';
let allDevices = false;
let customWidth = null;
let customHeight = null;
let fullPage = false;
let forceDark = false;
let testBothThemes = false;
let groupName = '🧪 Automated Test';
let waitForSelector = null;
let clickSelector = null;
let evalScript = null;
let timeoutMs = 30000;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === '--url' || arg === '-u') && args[i + 1]) {
    urls.push(args[++i]);
  } else if (arg === '--urls' && args[i + 1]) {
    urls = urls.concat(args[++i].split(',').map(s => s.trim()));
  } else if (arg === '--sitemap' && args[i + 1]) {
    sitemapUrl = args[++i];
  } else if (arg === '--scenario' && args[i + 1]) {
    scenarioFile = args[++i];
  } else if (arg === '--out-dir' || arg === '-o') {
    outDir = args[++i];
  } else if (arg === '--baseline-dir' && args[i + 1]) {
    baselineDir = args[++i];
    doDiff = true;
  } else if (arg === '--diff') {
    doDiff = true;
  } else if (arg === '--a11y' || arg === '--accessibility') {
    doA11y = true;
  } else if (arg === '--device' || arg === '-d') {
    preset = args[++i].toLowerCase();
  } else if (arg === '--all-devices') {
    allDevices = true;
  } else if (arg === '--viewport' || arg === '-v') {
    const parts = args[++i].split('x');
    customWidth = parseInt(parts[0], 10);
    customHeight = parseInt(parts[1], 10);
  } else if (arg === '--dark') {
    forceDark = true;
  } else if (arg === '--both-themes') {
    testBothThemes = true;
  } else if (arg === '--full-page') {
    fullPage = true;
  } else if (arg === '--group' || arg === '-g' || arg === '--group-name') {
    groupName = args[++i];
  } else if (arg === '--wait-for') {
    waitForSelector = args[++i];
  } else if (arg === '--click') {
    clickSelector = args[++i];
  } else if (arg === '--eval') {
    evalScript = args[++i];
  } else if (arg === '--timeout') {
    timeoutMs = parseInt(args[++i], 10) || 30000;
  } else if (arg === '--help' || arg === '-h') {
    showHelp();
    process.exit(0);
  }
}

function showHelp() {
  console.log(`
=============================================================================
 Universal Zero-Interruption Headless Browser Visual Testing Engine
=============================================================================

Usage:
  headless-test --url <url> [options]
  headless-test --sitemap <sitemap.xml> [options]
  headless-test --scenario <test.yaml|test.json> [options]

Target Selection:
  --url, -u <url>         Target webpage URL (http://localhost:3000, https://example.com)
  --urls <url1,url2>      Comma-separated list of URLs
  --sitemap <url>         Crawl and capture all pages listed in an XML sitemap
  --scenario <file>       Run declarative test scenario (YAML or JSON)

Visual Regression & Audits:
  --diff                  Enable pixel-by-pixel visual diffing against baseline
  --baseline-dir <dir>    Directory containing baseline (Before) images
  --a11y, --accessibility Run automated WCAG 2.1 AA accessibility audit (axe-core)

Device & Responsiveness:
  --device, -d <preset>   Device preset: desktop (default), laptop, tablet, mobile, fullhd, 4k
  --all-devices           Test all major form factors (Desktop, Tablet, Mobile)
  --viewport, -v <WxH>    Set custom viewport (e.g. 1600x900)
  --full-page             Capture full scrolling height of the page

Theme & Grouping:
  --both-themes           Capture both Light and Dark mode versions automatically
  --dark                  Force dark theme
  --group, -g <name>      Tab Group / Test session label (default: "🧪 Automated Test")

Interactions:
  --wait-for <selector>   Wait for CSS selector before capturing
  --click <selector>      Click element before capturing
  --eval "<javascript>"   Execute JS expression on page before capturing
  --out-dir, -o <dir>     Destination directory for screenshot artifacts
  `);
}

if (urls.length === 0 && !sitemapUrl && !scenarioFile) {
  showHelp();
  process.exit(0);
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function sanitizeFilename(url, theme, devName = '', suffix = '') {
  let name = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 45);
  if (name.endsWith('_')) name = name.slice(0, -1);
  return `${name}_${theme}${devName ? '_' + devName : ''}${suffix ? '_' + suffix : ''}.png`;
}

async function run() {
  // If sitemap is requested, parse URLs
  if (sitemapUrl) {
    console.log(`[Sitemap] Fetching and parsing sitemap from: ${sitemapUrl}...`);
    const sitemapUrls = await parseSitemap(sitemapUrl);
    console.log(`[Sitemap] Discovered ${sitemapUrls.length} URL(s).`);
    urls = urls.concat(sitemapUrls);
  }

  const devicesToTest = allDevices
    ? [DEVICE_PRESETS.desktop, DEVICE_PRESETS.tablet, DEVICE_PRESETS.mobile]
    : [DEVICE_PRESETS[preset] || { name: 'custom', width: customWidth || 1440, height: customHeight || 960, scale: 2 }];

  const themesToTest = testBothThemes ? ['light', 'dark'] : [forceDark ? 'dark' : 'light'];

  console.log(`[Headless Engine] Launching silent background browser (${chromePath})...`);
  console.log(`[Headless Engine] Tab Group Tag: "[${groupName}]"`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-background-timer-throttling'
    ]
  });

  const page = await browser.newPage();

  // Execute Scenario if provided
  if (scenarioFile) {
    console.log(`[Scenario] Loading declarative scenario: ${scenarioFile}...`);
    const scenario = loadScenario(scenarioFile);
    await page.setViewport({
      width: devicesToTest[0].width,
      height: devicesToTest[0].height,
      deviceScaleFactor: devicesToTest[0].scale || 2
    });
    const scenarioReport = await executeScenario(scenario, page, { outDir });
    console.log(`[Scenario] Result: ${scenarioReport.results.filter(r => r.passed).length}/${scenarioReport.results.length} steps passed.`);
  }

  // Execute URLs
  const summaryReport = {
    testedAt: new Date().toISOString(),
    totalTargets: urls.length,
    results: []
  };

  for (const url of urls) {
    console.log(`\n======================================================`);
    console.log(`[Testing Target] ${url}`);
    console.log(`======================================================`);

    for (const dev of devicesToTest) {
      await page.setViewport({ width: dev.width, height: dev.height, deviceScaleFactor: dev.scale || 2 });
      console.log(`  📱 Device: ${dev.name.toUpperCase()} (${dev.width}x${dev.height})`);

      for (const theme of themesToTest) {
        console.log(`    🎨 Theme: [${theme.toUpperCase()}]`);
        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs });

          // Tag tab in DOM and title
          await page.evaluate((grp) => {
            if (!document.title.startsWith(`[${grp}]`)) {
              document.title = `[${grp}] ` + document.title;
            }
          }, groupName);

          // Apply theme
          if (theme === 'dark') {
            await page.evaluate(() => {
              document.documentElement.setAttribute('data-theme', 'dark');
              document.documentElement.setAttribute('data-bs-theme', 'dark');
              document.documentElement.setAttribute('data-app-theme', 'dark');
              document.documentElement.setAttribute('data-color-mode', 'dark');
              document.documentElement.classList.add('dark');
              if (document.body) {
                document.body.setAttribute('data-bs-theme', 'dark');
                document.body.classList.add('dark-theme', 'dark-mode');
              }
            });
            await new Promise(r => setTimeout(r, 600));
          }

          // Optional interactions
          if (waitForSelector) {
            await page.waitForSelector(waitForSelector, { timeout: 10000 });
          }
          if (clickSelector) {
            await page.click(clickSelector);
            await new Promise(r => setTimeout(r, 600));
          }
          if (evalScript) {
            await page.evaluate(evalScript);
            await new Promise(r => setTimeout(r, 400));
          }

          // Capture Screenshot
          const filename = sanitizeFilename(url, theme, dev.name !== 'desktop' ? dev.name : '');
          const destPath = path.join(outDir, filename);
          await page.screenshot({ path: destPath, fullPage });
          const stats = fs.statSync(destPath);
          console.log(`    ✅ Screenshot: ${filename} (${Math.round(stats.size / 1024)} KB)`);

          const targetResult = {
            url,
            device: dev.name,
            theme,
            screenshot: destPath
          };

          // 🔍 Visual Diffing
          if (doDiff && baselineDir) {
            const baselinePath = path.join(baselineDir, filename);
            const diffPath = path.join(outDir, `diff_${filename}`);
            const diffResult = await compareImages(baselinePath, destPath, diffPath);
            targetResult.diff = diffResult;

            if (diffResult.isNew) {
              console.log(`    📸 Baseline initialized.`);
            } else if (diffResult.isMatch) {
              console.log(`    ✨ Visual Diff: 100% Match (${diffResult.diffPixels} diff pixels).`);
            } else {
              console.warn(`    ⚠️ Visual Regression Detected! ${diffResult.mismatchPercentage}% mismatch (${diffResult.diffPixels} diff pixels).`);
              console.warn(`       Diff image: ${diffPath}`);
            }
          }

          // ⚡ Accessibility Audit
          if (doA11y) {
            console.log(`    ♿ Running Accessibility Audit...`);
            const a11yResult = await auditPage(page);
            targetResult.a11y = a11yResult;
            console.log(`       Score: ${a11yResult.score}/100 | Critical: ${a11yResult.criticalCount} | Serious: ${a11yResult.seriousCount} | Total Issues: ${a11yResult.totalViolations}`);
          }

          summaryReport.results.push(targetResult);
        } catch (err) {
          console.error(`    ❌ Error on ${url} [${theme}] [${dev.name}]:`, err.message);
          summaryReport.results.push({ url, device: dev.name, theme, error: err.message });
        }
      }
    }
  }

  await browser.close();

  // Write JSON report
  const reportPath = path.join(outDir, 'visual_test_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(summaryReport, null, 2));
  console.log(`\n======================================================`);
  console.log(`[Summary] Tests finished. Report saved to: ${reportPath}`);
  console.log(`[Summary] Execution was 100% silent in-memory with zero desktop interruptions.`);
  console.log(`======================================================`);
}

run().catch(err => {
  console.error('[Fatal Error]:', err);
  process.exit(1);
});
