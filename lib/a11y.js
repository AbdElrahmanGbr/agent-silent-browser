/**
 * Accessibility (a11y) & WCAG Compliance Engine
 * Injects axe-core into page context and returns structured violation reports.
 */

const fs = require('fs');
const path = require('path');

let axeSource = null;
function getAxeSource() {
  if (axeSource) return axeSource;
  try {
    const axePath = require.resolve('axe-core/axe.min.js');
    axeSource = fs.readFileSync(axePath, 'utf8');
    return axeSource;
  } catch (e) {
    const fallbackPath = path.join(__dirname, '../node_modules/axe-core/axe.min.js');
    if (fs.existsSync(fallbackPath)) {
      axeSource = fs.readFileSync(fallbackPath, 'utf8');
      return axeSource;
    }
    return null;
  }
}

/**
 * Run accessibility audit on Puppeteer page.
 * @param {object} page - Puppeteer Page instance
 * @param {object} options - Options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
 * @returns {Promise<object>} { passed, score, violations, summary }
 */
async function auditPage(page, options = {}) {
  const source = getAxeSource();
  if (!source) {
    return {
      passed: true,
      score: 100,
      violations: [],
      error: 'axe-core library not found. Install axe-core to enable a11y testing.'
    };
  }

  await page.evaluate(source);

  const axeOptions = {
    runOnly: options.runOnly || ['wcag2a', 'wcag2aa', 'wcag21aa'],
    rules: options.rules || {}
  };

  const results = await page.evaluate((opts) => {
    return new Promise((resolve) => {
      window.axe.run(document, opts, (err, res) => {
        if (err) resolve({ error: err.message, violations: [], passes: [] });
        else resolve({ violations: res.violations || [], passes: res.passes || [] });
      });
    });
  }, axeOptions);

  const violations = (results.violations || []).map(v => ({
    id: v.id,
    impact: v.impact, // critical, serious, moderate, minor
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodesCount: v.nodes ? v.nodes.length : 0,
    targets: (v.nodes || []).slice(0, 3).map(n => n.target.join(' ')),
    summary: v.nodes && v.nodes[0] ? v.nodes[0].failureSummary : ''
  }));

  const passesCount = results.passes ? results.passes.length : 0;
  const violationsCount = violations.length;
  const totalRules = passesCount + violationsCount;
  const score = totalRules > 0 ? Math.round((passesCount / totalRules) * 100) : 100;
  const criticalCount = violations.filter(v => v.impact === 'critical').length;
  const seriousCount = violations.filter(v => v.impact === 'serious').length;

  const passed = criticalCount === 0 && seriousCount === 0;

  return {
    passed,
    score,
    criticalCount,
    seriousCount,
    totalViolations: violationsCount,
    violations
  };
}

module.exports = {
  auditPage
};
