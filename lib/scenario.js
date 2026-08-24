/**
 * Declarative Test Scenario Runner
 * Parses YAML or JSON test definitions and executes sequential browser actions.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { auditPage } = require('./a11y');

/**
 * Load test scenario from YAML or JSON file
 */
function loadScenario(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return yaml.load(content);
  }
  return JSON.parse(content);
}

/**
 * Execute scenario actions sequentially on Puppeteer page
 */
async function executeScenario(scenario, page, options = {}) {
  const outDir = options.outDir || process.cwd();
  const results = [];
  const name = scenario.name || 'Unnamed Scenario';

  console.log(`\n[Scenario Runner] Starting: "${name}"`);

  if (scenario.url) {
    console.log(`  -> Navigating to initial URL: ${scenario.url}`);
    await page.goto(scenario.url, { waitUntil: 'networkidle2', timeout: 30000 });
  }

  const steps = scenario.steps || scenario.actions || [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepDesc = step.name || `Step ${i + 1}`;
    console.log(`  [Step ${i + 1}/${steps.length}] ${stepDesc}`);

    try {
      if (step.goto) {
        await page.goto(step.goto, { waitUntil: 'networkidle2', timeout: 30000 });
        results.push({ step: stepDesc, action: 'goto', passed: true });
      }

      if (step.wait_for) {
        await page.waitForSelector(step.wait_for, { timeout: step.timeout || 10000 });
        results.push({ step: stepDesc, action: 'wait_for', passed: true });
      }

      if (step.click) {
        await page.click(step.click);
        await new Promise(r => setTimeout(r, step.delay || 500));
        results.push({ step: stepDesc, action: 'click', passed: true });
      }

      if (step.type) {
        await page.type(step.type.selector, step.type.text, { delay: 50 });
        results.push({ step: stepDesc, action: 'type', passed: true });
      }

      if (step.scroll_to) {
        await page.evaluate((target) => {
          if (typeof target === 'string') {
            const el = document.querySelector(target);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          } else if (typeof target === 'number') {
            window.scrollTo({ top: target, behavior: 'smooth' });
          }
        }, step.scroll_to);
        await new Promise(r => setTimeout(r, 600));
        results.push({ step: stepDesc, action: 'scroll_to', passed: true });
      }

      if (step.toggle_theme) {
        await page.evaluate((theme) => {
          document.documentElement.setAttribute('data-theme', theme);
          document.documentElement.setAttribute('data-bs-theme', theme);
          document.documentElement.setAttribute('data-app-theme', theme);
          document.documentElement.setAttribute('data-color-mode', theme);
        }, step.toggle_theme);
        await new Promise(r => setTimeout(r, 500));
        results.push({ step: stepDesc, action: 'toggle_theme', passed: true });
      }

      if (step.eval) {
        await page.evaluate(step.eval);
        results.push({ step: stepDesc, action: 'eval', passed: true });
      }

      if (step.assert_element) {
        const el = await page.$(step.assert_element);
        const passed = el !== null;
        results.push({ step: stepDesc, action: 'assert_element', passed, details: `Element: ${step.assert_element}` });
        if (!passed) console.warn(`     Assertion failed: element not found (${step.assert_element})`);
      }

      if (step.assert_text) {
        const text = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? el.textContent : '';
        }, step.assert_text.selector);
        const passed = text.includes(step.assert_text.contains);
        results.push({ step: stepDesc, action: 'assert_text', passed, details: `Expected: "${step.assert_text.contains}"` });
        if (!passed) console.warn(`     Assertion failed: text "${step.assert_text.contains}" not found in ${step.assert_text.selector}`);
      }

      if (step.a11y_check) {
        console.log(`     Running accessibility audit on step...`);
        const a11yResult = await auditPage(page);
        results.push({ step: stepDesc, action: 'a11y_check', passed: a11yResult.passed, score: a11yResult.score, violations: a11yResult.violations });
      }

      if (step.screenshot) {
        const filename = typeof step.screenshot === 'string' ? step.screenshot : `step_${i + 1}.png`;
        const destPath = path.isAbsolute(filename) ? filename : path.join(outDir, filename);
        await page.screenshot({ path: destPath, fullPage: !!step.full_page });
        console.log(`     Saved screenshot: ${destPath}`);
        results.push({ step: stepDesc, action: 'screenshot', passed: true, path: destPath });
      }
    } catch (err) {
      console.error(`  ❌ Error in step ${i + 1} (${stepDesc}):`, err.message);
      results.push({ step: stepDesc, passed: false, error: err.message });
      if (step.abort_on_fail !== false) {
        break;
      }
    }
  }

  return {
    scenarioName: name,
    totalSteps: steps.length,
    results
  };
}

module.exports = {
  loadScenario,
  executeScenario
};
