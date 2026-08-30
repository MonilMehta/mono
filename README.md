# mono

**mono** is a fast, keyboard-first utility app for everyday dev work — JSON inspection, API helpers, image tools, Expo assets, and more. Most tools run entirely in your browser; shareable mock API responses are encoded in their generated endpoint URL.

<p align="center">
  <img src="public/logo.svg" alt="mono" width="48" height="48" />
</p>

## Why mono

- **18 tools, one place** — format JSON, decode JWTs, convert CSV, transfer files and text, generate types and mock endpoints, inspect diagnostics, build deep links, and more
- **Keyboard-first** — jump anywhere with `⌘K`, cycle tools with `⌘]` / `⌘[`, collapse the sidebar with `⌘B`
- **Private by design** — no accounts; processing stays client-side except when you explicitly use Transfer
- **Built for real payloads** — debounced parsing, paginated tree views, and drag-and-drop for large JSON and images

## Quick start

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). JSON loads by default.

```bash
yarn build    # production build
yarn start    # run production server
yarn lint     # lint
```

### Deep links

Switch tools via URL:

```
/?tool=jwt
/?tool=csv
/?tool=image
```

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `⌘/` | Open command palette |
| `⌘]` / `⌘[` | Next / previous tool |
| `⌘B` | Collapse / expand sidebar |
| `⌘F` | Focus search (in JSON output view) |
| `↑` `↓` `Enter` | Navigate & select in palette |

## Tools

### Data
| Tool | Description |
|---|---|
| **JSON** | Format, validate, tree view with search, copy path/value, delete nodes, file drop |
| **Diff** | Line-by-line text/JSON comparison |
| **CSV** | CSV/TSV ↔ JSON, JSON → Markdown tables |
| **Schema & Mocks** | JSON → TypeScript, Zod, mock data, factories, or MSW handlers |
| **cURL** | curl → fetch, Axios, Python, undici, React Query, RN fetch |
| **Mock API** | Generate a short-lived endpoint with custom GET, POST, and PATCH JSON responses |
| **Transfer** | Send text or files with an expiring, one-time code |

### Media
| Tool | Description |
|---|---|
| **Image** | Inspect, compress, resize, extract palette, Base64 export |
| **SVG** | Preview, minify, export as React / React Native JSX |

### Mobile
| Tool | Description |
|---|---|
| **BlurHash** | Generate BlurHash & ThumbHash + Expo snippet |
| **App Assets** | Icon, adaptive icon, splash, favicon from one logo |
| **Deep Link** | Build Expo / universal links with `app.json` snippet |

### Encode
| Tool | Description |
|---|---|
| **Encode & Auth** | Base64, JWT decoding, and UUID generation |
| **URL** | Encode/decode components, parse full URLs |

### Time · Design · Debug
| Tool | Description |
|---|---|
| **Timestamp** | Unix ↔ ISO, live clock, relative time |
| **Color** | Hex, RGB, HSL with picker; Tailwind/RN copy |
| **Regex** | Live pattern testing with match highlighting |
| **Logs & Traces** | Parse logs, filter errors, and clean JS/RN stack traces |

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion

## Project layout

```
app/                  Next.js app router, layout, styles
components/
  app-shell.tsx       Sidebar, header, routing
  command-palette.tsx ⌘K search
  tools/              One file per tool
lib/
  tools-registry.ts   Tool metadata & categories
  json-utils.ts       JSON parse, stats, tree delete
  …                   Per-domain helpers (csv, curl, log, stack, etc.)
public/               Logo, favicons
```

## Adding a tool

1. Create `components/tools/my-tool.tsx` — use `ToolCard`, `ToolTextarea`, `ToolBar`, `EmptyState` from `components/tool-card.tsx`
2. Register in `lib/tools-registry.ts` (`ToolId` + `TOOLS` entry)
3. Wire in `components/app-shell.tsx` → `TOOL_COMPONENTS`

The sidebar, palette, and shortcuts pick it up automatically.

## Privacy

Most processing runs in your browser. The Transfer tool uploads its selected text or file to private storage; its one-time code expires after 10 minutes, downloaded files are deleted immediately, and unclaimed files are removed by daily cleanup. Transfers are encrypted in transit but are not end-to-end encrypted. Mock API response bodies are stored in Redis for four hours, so they should not contain secrets. In production, [Vercel Analytics](https://vercel.com/analytics) records page views only.

## License

Private — see repository owner for usage terms.
