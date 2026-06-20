# TechWriter AI ✦

> A production-ready AI-powered technical writing platform for developers, students, and content creators. Generate, edit, analyze, and export professional technical articles for Medium, DEV Community, Tutorials Dojo, personal blogs, and documentation sites.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [Project Structure](#project-structure)
6. [Environment Variables](#environment-variables)
7. [Running in Development](#running-in-development)
8. [Building for Production](#building-for-production)
9. [Deploying](#deploying)
10. [User Manual](#user-manual)
11. [Token Optimization Strategy](#token-optimization-strategy)
12. [Troubleshooting](#troubleshooting)
13. [Roadmap](#roadmap)

---

## Features

| Feature | Description |
|---|---|
| **AI Article Generation** | Generates full Markdown articles via Claude API with streaming |
| **Platform-Aware Writing** | Tailored tone/structure for Medium, DEV, Tutorials Dojo, Blogs, Docs |
| **Rich Markdown Editor** | Edit / Preview / Split view with toolbar formatting shortcuts |
| **Live Grammar Checker** | Passive voice, repeated words, sentence length — runs locally |
| **Writing Quality Score** | 0–100 score based on style analysis, no API calls |
| **Word Counter** | Words, characters, reading time, paragraph count — real-time |
| **Image Analyzer** | Local image analysis for platform compatibility (dimensions, size, ratio) |
| **AI Rewrite Tools** | Rewrite selections in 5 styles: Professional, Beginner-Friendly, Concise, Technical, SEO |
| **Version History** | Full undo/redo stack with session-based version restore |
| **Autosave** | Saves to localStorage every 1.5 seconds |
| **Export** | Download as Markdown, HTML, or Plain Text |
| **Token-Efficient** | Articles stored locally; only selected sections sent to AI |

---

## Tech Stack

- **Framework**: React 18 (via Vite)
- **Language**: JavaScript (JSX)
- **Styling**: Inline CSS with CSS variables (no external CSS framework)
- **Icons**: Tabler Icons (CDN webfont)
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`) with streaming
- **Storage**: Browser localStorage (autosave + version history)
- **Fonts**: IBM Plex Sans + JetBrains Mono (Google Fonts)
- **Image Analysis**: Native browser APIs (`Image`, `FileReader`) — zero backend

---

## Prerequisites

Before you begin, make sure you have the following installed:

| Tool | Version | Install |
|---|---|---|
| **Node.js** | v18.0.0 or higher | [nodejs.org](https://nodejs.org) |
| **npm** | v9.0.0 or higher | Comes with Node.js |
| **Git** | Any recent version | [git-scm.com](https://git-scm.com) |
| **Anthropic API Key** | Active key with Claude access | [console.anthropic.com](https://console.anthropic.com) |

To verify your Node and npm versions:

```bash
node --version   # Should print v18.x.x or higher
npm --version    # Should print 9.x.x or higher
```

---

## Quick Start

The fastest way to get TechWriter AI running locally:

```bash
# 1. Create a new Vite + React project
npm create vite@latest techwriter-ai -- --template react.
cd techwriter-ai

# 2. Install dependencies
npm install

# 3. Replace the main component
# Copy techwriter-ai.jsx into src/App.jsx
cp /path/to/techwriter-ai.jsx src/App.jsx

# 4. Set your Anthropic API key (see Environment Variables section)
echo "VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# 5. Start the dev server
npm run dev
```

Then open **http://localhost:5173** in your browser

---

## Project Structure

After setup, your project directory should look like this:

```
techwriter-ai/
├── public/
│   └── vite.svg
├── src/
│   ├── App.jsx          ← Main TechWriter AI component (paste here)
│   ├── main.jsx         ← React entry point
│   └── index.css        ← Global resets (can be emptied)
├── .env                 ← Your API key (never commit this)
├── .gitignore
├── index.html           ← Root HTML (add Google Fonts link here)
├── package.json
└── vite.config.js
```

---

## Environment Variables

Create a `.env` file in the root of your project:

```env
VITE_ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxx
```

> **Important:** The `VITE_` prefix is required for Vite to expose variables to the browser. Never commit your `.env` file. Add `.env` to `.gitignore`.

### Connecting the API key to the app

In `src/App.jsx`, the `callClaude` function sends requests to the Anthropic API. By default it relies on the API key being passed through headers. To wire up your `.env` key, update the fetch call in `callClaude`:

```js
// In the callClaude function, update the headers:
headers: {
  "Content-Type": "application/json",
  "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
},
```

> **Note on browser API calls:** Calling the Anthropic API directly from the browser is fine for local development and personal tools. For a public SaaS product, route API calls through a backend (see [Deploying](#deploying) section).

---

## Running in Development

```bash
# Start dev server with hot reload
npm run dev

# The app will be available at:
# http://localhost:5173
```

The dev server supports hot module replacement — edits to `App.jsx` reflect instantly in the browser without a full reload

---

## Building for Production

```bash
# Build optimized static files into /dist
npm run build

# Preview the production build locally
npm run preview
```

The `dist/` folder contains all static assets ready for deployment.

---

## Deploying

### Option A — Vercel (Recommended, easiest)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project root
vercel

# Set your API key as an environment variable in the Vercel dashboard:
# Project → Settings → Environment Variables
# VITE_ANTHROPIC_API_KEY = sk-ant-...
```

### Option B — Netlify

```bash
# Build the project
npm run build

# Drag and drop the /dist folder to netlify.com/drop
# Or use the Netlify CLI:
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

Set `VITE_ANTHROPIC_API_KEY` in Netlify → Site settings → Environment variables.

### Option C — GitHub Pages

```bash
# Install gh-pages
npm install --save-dev gh-pages

# Add to package.json scripts:
# "deploy": "npm run build && gh-pages -d dist"

npm run deploy
```

### Option D — Self-hosted (VPS/Docker)

```bash
# Build
npm run build

# Serve with any static file server, e.g. serve:
npm install -g serve
serve -s dist -l 3000
```

### Backend Proxy (for production SaaS)

To avoid exposing your API key in the browser, create a simple proxy server:

```js
// server.js (Node.js + Express example)
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/api/generate", async (req, res) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(req.body),
  });
  // Stream the response back to the client
  response.body.pipe(res);
});

app.listen(3001);
```

Then change the fetch URL in `callClaude` from `https://api.anthropic.com/v1/messages` to `/api/generate`.

---

## User Manual

### Tab 1 — Generate

This is where you create a new article from scratch.

**Fields:**

| Field | Description | Example |
|---|---|---|
| Topic / Title | The subject of your article | "Building a REST API with Node.js" |
| Target Platform | Where the article will be published | Medium, DEV, Docs, etc. |
| Tech Stack | Technologies used in the article | "React, TypeScript, Vite" |
| Audience Level | Reader's experience level | Beginner / Intermediate / Advanced / Expert |
| SEO Keywords | Comma-separated keywords for search optimization | "REST API, Express, Node tutorial" |

**Steps:**
1. Fill in the Topic field (required).
2. Select your Target Platform — this changes the writing style and formatting.
3. Optionally add Tech Stack, Audience, and Keywords for better output.
4. Click **Generate Article**.
5. The article streams in real time. When complete, you are automatically taken to the Editor tab.

---

### Tab 2 — Editor

The main workspace for reviewing and refining your article.

#### View Modes

| Mode | Description |
|---|---|
| **Edit** | Raw Markdown text editor — full keyboard control |
| **Preview** | Rendered HTML view of the Markdown |
| **Split** | Side-by-side edit and preview simultaneously |

Toggle between modes using the buttons in the top-right of the editor toolbar.

#### Toolbar Actions

| Button | Action | Keyboard Shortcut |
|---|---|---|
| Undo | Revert last change | Ctrl/Cmd + Z |
| Redo | Reapply undone change | Ctrl/Cmd + Shift + Z |
| Bold | Wrap selection in `**...**` | — |
| Italic | Wrap selection in `*...*` | — |
| Code | Wrap selection in backticks | — |
| Blockquote | Prepend `> ` to line | — |

#### Word Counter Bar

Located below the toolbar. Updates in real time as you type:

- **Words** — total word count
- **Chars** — total character count
- **Reading time** — estimated at 200 words per minute
- **Paragraphs** — blank-line-separated blocks
- **Quality score** — 0–100 writing quality (higher is better)

#### Grammar & Style Panel

Appears at the bottom of the editor when issues are detected. Color-coded badges:

- 🟡 **Yellow** — Passive voice detected (e.g. "was created by")
- 🔴 **Red** — Repeated word used more than 5 times
- 🟢 **Green** — Sentence length warnings

No API calls are made. All analysis runs locally in JavaScript.

#### Autosave

The editor autosaves to `localStorage` 1.5 seconds after you stop typing. You'll see the timestamp update in the header bar. Your work is restored automatically when you reopen the app.

---

### Sidebar — AI Rewrite

Use this to rephrase selected content in a different style.

**How to use:**
1. Optionally paste a specific paragraph into the "Target Text" field.
   - If left empty, the first ~500 characters of the article are used.
2. Click one of the 5 style buttons:
   - **Professional** — Formal, business-appropriate tone
   - **Beginner-Friendly** — Simpler language, more explanation
   - **Concise** — Removes filler, tightens prose
   - **Technical** — Precise, spec-like language
   - **SEO Optimized** — Keyword-rich, structured for search engines
3. The rewritten result appears below.
4. Click **Apply to Editor** to append it to your article, or **Dismiss** to discard.

> **Token efficiency:** Only the selected/pasted text is sent to the API — never the full article. This keeps costs minimal.

---

### Sidebar — Export

Download your article in three formats:

| Format | File | Best For |
|---|---|---|
| **Markdown** | `.md` | DEV Community, GitHub README, Hugo, Jekyll, Docusaurus |
| **HTML** | `.html` | Self-hosted blogs, email newsletters, web publishing |
| **Plain Text** | `.txt` | Universal, no formatting, simple copy-paste |

Click any export button to trigger an immediate download.

---

### Sidebar — Version History

Every time you make a meaningful change, a new version is saved in memory.

- **Versions list** — shows all versions with timestamp and word count
- **Current** — highlighted in blue
- **Restore** — click to roll back to any previous version

> Version history is session-based. It resets when you close or refresh the tab. The most recent version is always preserved in `localStorage` via autosave.

---

### Tab 3 — Image Analyzer

Analyze images before adding them to your article — no AI required.

**How to use:**
1. Click the upload area or drag and drop one or more images.
2. Each image is instantly analyzed and displays:
   - **Filename**
   - **Dimensions** — width × height in pixels
   - **File size** — in megabytes
   - **Aspect ratio** — simplified (e.g. 16:9, 4:3)
   - **Resolution quality** — Low / Good / High based on pixel count
3. A **Platform Compatibility** row shows ✓ or ✗ for each platform.
4. Issues are listed beneath (e.g. "Width too small (need ≥900px)").

**Platform image requirements used for analysis:**

| Platform | Min Width | Min Height | Max Size | Recommended Ratio |
|---|---|---|---|---|
| Medium | 900px | 500px | 5MB | 16:9 |
| DEV Community | 1000px | 420px | 3MB | 2.4:1 |
| Tutorials Dojo | 800px | 450px | 4MB | 16:9 |
| Personal Blog | 600px | 300px | 8MB | Any |
| Documentation | 700px | 400px | 5MB | Any |

All analysis is done locally using the browser's native `Image` object. No image data is sent to any server.

---

## Token Optimization Strategy

TechWriter AI is designed to minimize API costs without sacrificing quality:

| Strategy | Implementation |
|---|---|
| **Local storage of articles** | Generated articles are saved in React state and localStorage — never re-sent to the AI |
| **Selective rewriting** | Only pasted/selected text is sent for rewrites, not the full article |
| **Local grammar checking** | Regex-based passive voice, repetition, and sentence analysis — zero API calls |
| **Local image analysis** | Browser `Image` API for all dimension/size/ratio checks — zero API calls |
| **Streaming responses** | `stream: true` on all API calls — faster perceived performance, same token cost |
| **Focused system prompts** | Concise, role-specific system prompts — avoids padding tokens |
| **No redundant calls** | No polling, no re-generation, no duplicate requests |

---

## Troubleshooting

### "Failed to generate" error on article creation

- Check that your `VITE_ANTHROPIC_API_KEY` is set correctly in `.env`
- Make sure you added the `x-api-key` and `anthropic-dangerous-direct-browser-access` headers to the `callClaude` function
- Check the browser console (F12) for the full error message
- Verify your API key is active at [console.anthropic.com](https://console.anthropic.com)

### Article generates but appears blank

- Switch the editor to **Preview** mode to see rendered output
- The raw Markdown may look sparse in Edit mode — this is normal

### Autosave not working

- Check that your browser allows localStorage (not in private/incognito mode with strict settings)
- Try `localStorage.getItem("tw_autosave")` in the browser console to verify

### Images not analyzing

- Only image files are accepted (`image/jpeg`, `image/png`, `image/gif`, `image/webp`)
- Make sure you're dropping files directly, not folders

### Build fails with "Cannot find module" errors

```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### CORS errors when calling Anthropic API

This only happens in certain browser/proxy configurations. Add this header to the fetch call:

```js
"anthropic-dangerous-direct-browser-access": "true"
```

For production, use a backend proxy to avoid CORS entirely (see [Deploying](#deploying)).

---

## Roadmap

Potential features for future versions:

- [ ] **DOCX export** — using `docx` npm package
- [ ] **PDF export** — using `jsPDF` or Puppeteer on backend
- [ ] **Multi-article dashboard** — manage multiple drafts with IndexedDB
- [ ] **Custom templates** — user-defined article structure templates
- [ ] **Outline-first generation** — generate outline, approve, then expand section by section
- [ ] **SEO score integration** — keyword density analysis with local scoring
- [ ] **Code syntax highlighting** — Prism.js or highlight.js in Preview mode
- [ ] **Dark/light mode toggle** — explicit user preference override
- [ ] **Collaboration** — shared editing via WebSocket or Liveblocks
- [ ] **Backend API** — Express/Hono proxy for secure SaaS deployment
- [ ] **User accounts** — Supabase or Firebase auth + article storage

---

## License

MIT — free to use, modify, and deploy.

---

*Built with Claude Sonnet + React + Vite*
