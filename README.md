# Maghreb Rayonnage Dashboard

A business CRM dashboard, built with React + Vite + Tailwind CSS on the front end, and a small Express + SQLite API
that powers a real Claude-backed AI assistant. All CRM data (clients, vaults, meetings, revenue) is still mocked in
`src/data/mockData.js` — there is no authentication and no CRM database yet. Only the AI assistant's conversation
history is persisted, in `server/data.sqlite`.

## Stack

- React 18 + React Router 6, Vite, Tailwind CSS, [lucide-react](https://lucide.dev/) for icons
- Express + `better-sqlite3` for the local API/DB (`server/`)
- [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) to call the Claude API

## Getting started

```bash
npm install
cp .env.example .env   # then edit .env and paste your ANTHROPIC_API_KEY
npm run dev
```

`npm run dev` starts both the Vite dev server (`http://localhost:5173`) and the API server
(`http://localhost:8787`) together, via `concurrently`. The Vite dev server proxies `/api/*` requests to the API
server, so the front end can just call `fetch('/api/...')`.

Without a valid `ANTHROPIC_API_KEY`, every other page still works normally — only the Assistant IA page will show
an inline error when you try to send a message.

## Pages

- `/login` — Sign-in screen (French copy, mock auth — any input navigates to the dashboard)
- `/dashboard` — Main dashboard: KPI stat cards, "Croissance du CA" chart, vault list, upcoming meetings, recent activity
- `/clients` — Global "Aperçu des clients" table across all vaults, with status filters
- `/vault/:vaultId` — Scoped dashboard for a single company/vault, with its own stats, chart and client table
- `/assistant` — Full-screen "Assistant IA" chat, backed by the Claude API (see below)
- `/settings` — Profile & preferences screen

## Assistant IA (`/assistant`)

- Full-screen, Claude-style chat UI: centered column, user bubbles right-aligned, AI replies left-aligned with no
  bubble, auto-expanding textarea, suggested prompt chips on the empty state, and a three-dot typing indicator.
- This assistant is global (not scoped to a vault) — its system prompt gives it awareness of all three companies.
- Conversation history is stored in SQLite (`server/data.sqlite`, table `messages`: `id`, `role`, `content`,
  `timestamp`) via `server/db.js`, and reloaded on page load from `GET /api/messages`.
- Sending a message hits `POST /api/chat`, which stores the user message, calls the Claude API
  (`claude-sonnet-4-6`, `max_tokens: 1024`) with the full history via `server/anthropic.js`, stores the reply, and
  returns both messages.
- The quick slide-in chat panel (`ChatPanel.jsx`, opened from the top bar / mobile FAB on other pages) is unchanged
  and still uses canned mock replies — it is a separate, lightweight entry point from the rest of the app.

## Design notes

- Accent color: warm orange (`#E67E22`), see `tailwind.config.js` (`accent` palette)
- Cards use a 20px radius (`rounded-card`) with soft iOS-style shadows (`shadow-soft`, `shadow-softLg`)
- Font: Inter, loaded via Google Fonts in `index.html`
- Sidebar (desktop, `lg:` and up) collapses into a bottom tab bar (mobile, `MobileNav.jsx`) with a slide-up sheet for the vault list
- The AI assistant is a slide-in chat panel (`ChatPanel.jsx`), reachable from the top bar button (desktop) or floating action button (mobile)
