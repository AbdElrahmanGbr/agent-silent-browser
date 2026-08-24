# 🚀 Agent Silent Browser (`agent-silent-browser`)

> **Zero-Interruption, In-Memory Headless Visual Testing, Pixel Diffing, and Accessibility Auditing for AI Coding Agents and Developers.**

[![npm version](https://img.shields.io/npm/v/agent-silent-browser.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/agent-silent-browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Headless](https://img.shields.io/badge/Chromium-New%20Headless-blue.svg)](https://developer.chrome.com/docs/chromium/new-headless)

---

## 🎯 The Problem

When AI coding agents (Antigravity, Claude Code, Cursor, Copilot Workspace) or automated scripts perform browser testing, they often:
1. **Steal window focus** while you are actively typing code.
2. **Pop up desktop windows** that flash across your screen and interrupt your workflow.
3. **Mix test tabs** into your active browsing session.

## ✨ The Solution

**`agent-silent-browser`** runs 100% in-memory using Chromium's native new-headless engine:
* **Zero Desktop Window Popups**: Never opens a window on your desktop (X11, Wayland, or Windows DWM).
* **Zero Focus Stealing**: Renders in background RAM without stealing keyboard focus or mouse clicks.
* **Automatic Tab Group Tagging**: Prefixes test sessions with `[🧪 Automated Test: <Name>]` for clean isolation.
* **Pixel-by-Pixel Visual Diffing**: Detects unintended UI regressions with instant highlighting.
* **Built-in WCAG a11y Audits**: Injects `axe-core` to check contrast, ARIA tags, and form labels.
* **Cross-Platform**: Seamlessly detects Chrome, Edge, Chromium, and Brave on **Windows, macOS, and Linux**.

---

## 📦 Installation

### Global CLI
```bash
npm install -g agent-silent-browser
```

### Run via npx (No Install Required)
```bash
npx agent-silent-browser --url "http://localhost:3000" --both-themes
```

---

## ⚡ Quick Usage

### 1. Test Any URL & Capture Both Themes
```bash
headless-test --url "https://my-portfolio.dev" --both-themes --out-dir "./artifacts"
```

### 2. Multi-Device Responsive Testing (Desktop, Tablet, Mobile)
```bash
headless-test --url "http://localhost:3000" --all-devices --out-dir "./screenshots"
```

### 3. Visual Regression & Pixel Diffing
```bash
headless-test --url "http://localhost:3000" --diff --baseline-dir "./baseline" --out-dir "./diff_output"
```

### 4. Automated WCAG 2.1 AA Accessibility Audit
```bash
headless-test --url "http://localhost:3000" --a11y --both-themes
```

### 5. Crawl Complete Site via Sitemap
```bash
headless-test --sitemap "https://example.com/sitemap.xml" --both-themes
```

---

## 🤖 AI Agent & Slash Command Integration

### Google Antigravity & Open Agent
Type directly into your chat:
```text
/silent-test check http://localhost:3000 in dark mode
```

### Claude Code (`CLAUDE.md`)
```markdown
## Custom Commands
- `/silent-test <url>`: Run `npx agent-silent-browser --url "<url>" --both-themes`
```

### Cursor (`.cursorrules`)
```markdown
When testing UI, always run `npx agent-silent-browser --url "<url>" --both-themes`. Never open headful browser windows.
```

---

## 📝 Declarative YAML Test Scenarios

Create a `test.yaml` file to run multi-step interactive workflows:

```yaml
name: Checkout & Terms Page Verification
url: http://localhost:3000/terms
steps:
  - name: Wait for hero & TOC to load
    wait_for: ".hero-section"
  - name: Capture initial viewport
    screenshot: step1_hero.png
  - name: Smooth scroll to Acceptable Use
    scroll_to: "#acceptable-use"
  - name: Toggle Dark Theme
    toggle_theme: dark
  - name: Capture Dark Mode
    screenshot: step2_dark.png
  - name: Run Accessibility Check
    a11y_check: true
```

Run with:
```bash
headless-test --scenario test.yaml --out-dir "./results"
```

---

## 📄 License

MIT © 2026 AbdElrahman Gbr
