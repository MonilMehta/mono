# Dev Toolbox

A fast, keyboard-first collection of daily developer utilities — built for engineers who work with large JSON payloads, Expo/React Native apps, and web APIs every day. Everything runs client-side in the browser; nothing you paste ever leaves your machine.

## Features

### ⚡ Command palette

- **`⌘K`** or **`⌘/`** — open a floating, Raycast-style search palette to jump to any tool
- Fuzzy search across tool names, descriptions, and keywords (e.g. typing `b64` finds Base64, `guid` finds UUID)
- Arrow keys to navigate, `Enter` to select, `Esc` to close
- **`⌘]`** / **`⌘[`** — cycle to the next/previous tool (disabled while typing in an input, so it never fights with your text)
- Theme toggle built into the palette footer

### 🧰 Tools

| Tool | Category | What it does |
|---|---|---|
| **JSON** | Data | Format, validate, and explore large JSON payloads. Live tree view with search, expand/collapse all, copy path/value per node, line/column error pointers, drag-and-drop file upload, debounced parsing so large payloads don't freeze the tab |
| **Diff** | Data | Line-by-line comparison of two blocks of text/JSON with an LCS-based diff, add/remove counts |
| **JWT** | Auth | Decode a Bearer token's header and payload, flag expired tokens, copy signature |
| **Base64** | Encode | Encode/decode strings, with a URL-safe mode |
| **URL** | Encode | Encode/decode URL components, or parse a full URL into origin/path/query params |
| **Timestamp** | Time | Unix ↔ ISO conversion, live clock, human-readable relative time ("2 hours ago") |
| **UUID** | Generate | Generate one or many cryptographically random UUID v4s |
| **Image** | Media | Drag-and-drop image inspector — dimensions, aspect ratio, size, MIME type. Compress/convert to JPEG, WebP, or PNG with a quality slider and % savings. Base64 data URI export |
| **SVG** | Media | Paste or upload an SVG — live preview, minify (with % size saved), export as a React JSX component, export as React Native (`react-native-svg`) component, URL-encoded and Base64 data URIs |
| **Color** | Design | Convert between Hex, RGB, and HSL with a live swatch and color picker; copy in Tailwind/React Native formats |
| **Regex** | Debug | Test regular expressions live against a sample string with match highlighting and per-match details |
| **Deep Link** | Mobile | Build Expo deep links — custom scheme, Expo Go dev links, or universal links — with query params and a ready-to-paste `app.json` snippet |

### 🎨 UI

- Smooth animated transitions between tools (`framer-motion`)
- Sidebar navigation grouped by category, with an animated active-tool indicator
- Light/dark theme, respects system preference on first load
- Fully responsive — collapsible sidebar on mobile

## Getting started

This project uses **Yarn**.

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). The JSON tool loads by default; switch tools via the sidebar, `⌘K`, or the URL (`/?tool=jwt`, `/?tool=svg`, etc).

### Other scripts

```bash
yarn build   # production build
yarn start   # run the production build
yarn lint    # lint the project
```

## Tech stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Framer Motion** for animations
- **Lucide React** for icons

## Project structure

```
app/
  layout.tsx            Root layout, fonts, metadata
  page.tsx              Entry point — renders the toolbox
  globals.css           Theme tokens (light/dark) & Tailwind setup

components/
  dev-toolbox.tsx        App shell: sidebar, header, shortcuts, tool switching
  command-palette.tsx    ⌘K search palette
  theme-provider.tsx     Light/dark theme context
  tool-card.tsx           Shared card/textarea/toolbar primitives for tools
  copy-button.tsx         Reusable "copy to clipboard" button
  highlighted-text.tsx    Search-match text highlighter
  json-viewer.tsx         Collapsible/searchable JSON tree view
  tools/                  One component per tool (json, jwt, base64, url,
                           timestamp, uuid, color, diff, regex, deeplink,
                           image, svg)

lib/
  tools-registry.ts      Tool metadata: id, label, description, category, icon
  fuzzy.ts                Fuzzy string matching used by the command palette
  json-utils.ts           JSON parsing, stats, and error-location helpers
  debounce.ts             Debounce utility (used for JSON live-parsing)
  theme.ts                Card shadow tokens for light/dark mode
  utils.ts                Tailwind class merge helper (`cn`)
```

## Adding a new tool

1. Create `components/tools/my-tool.tsx` — a self-contained `'use client'` component. Reuse `ToolCard`, `ToolTextarea`, `ToolBar`, and `CopyButton` from `components/tool-card.tsx` / `components/copy-button.tsx` for a consistent look.
2. Register it in `lib/tools-registry.ts`: add a `ToolId`, an entry in `TOOLS` (label, description, category, icon, optional search keywords).
3. Wire it up in `components/dev-toolbox.tsx`: import the component and add it to `TOOL_COMPONENTS`.

That's it — the sidebar, command palette, and keyboard shortcuts pick it up automatically.

## Roadmap / Future Tools

- **Log Formatter**: Paste messy logs and get timestamp highlighting, JSON object extraction, error grouping, stack trace formatting, and filtering by level (error/warn/info).
- **Stack Trace Cleaner**: Paste stack traces from JS/RN/Next to separate app frames from node_modules, generate clean clickable-looking file paths, view compactly, and extract error messages.
- **CSV / TSV / JSON Converter**: Convert between CSV, TSV, and JSON. Turn arrays of objects into tables and copy as Markdown tables.
- **cURL → Code Converter**: Paste a cURL command and generate fetch, Axios, Python requests, Node undici, React Query mutation/query, and Expo/React Native-safe fetch snippets.
- **API Response Mocker**: Paste JSON and generate TypeScript types, Zod schemas, sample mock objects, factory functions, and MSW handlers.
- **TypeScript Type Generator**: Input JSON and output TypeScript interfaces/types, complete with optional fields detection, union handling, readonly toggles, and Zod schema generation.

## Privacy

Everything runs entirely in your browser. No payload, token, image, or file you paste/upload is sent to a server — the only third-party network call is [Vercel Analytics](https://vercel.com/analytics) (page views only, production builds only).
