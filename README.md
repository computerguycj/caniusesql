# caniusesql.com

> The definitive SQL compatibility reference. Stop guessing. Start building.

A caniuse.com-style resource for checking SQL feature support across PostgreSQL, MySQL, SQLite, SQL Server, and Oracle.

**[Try it live →](https://www.caniusesql.com)**

---

## Why This Exists

You're writing SQL and need to know: *Does this database support that?* Instead of jumping between five different documentation sites, caniusesql gives you a single, searchable compatibility matrix. Fast. Clean. Accurate.

## What You Get

- **Compatibility at a Glance** — Matrix view showing which SQL features work on each database
- **Smart Search** — Find commands instantly with the `/` shortcut
- **Compare Mode** — Line up multiple databases side-by-side
- **One-Click Copying** — Paste code snippets without friction
- **Popular This Week** — See what SQL features others are checking (live tracking)
- **Dark Mode** — Respects your OS preference
- **Persistent Filters** — Your database selection sticks around

## The Stack

Built lean and fast:
- **Generation** — Node.js static site generator
- **Hosting** — Vercel (zero-config deployments)
- **Data** — Pre-rendered HTML with embedded JSON
- **Analytics** — Upstash Redis for popularity tracking

## How It Works

```
data.json (source of truth)
    ↓
generate.js (builds static pages)
    ↓
dist/ (one HTML file per command + homepage)
    ↓
Vercel (serves + runs API functions)
```

The build step (`node generate.js`) reads your data and generates:
- Individual pages for each SQL command
- Homepage with full index
- Sitemap for search engines
- API functions that log views and return trending commands

No build toolchain complexity. No client-side rendering delays.

## Getting Started

### Local Setup

```bash
git clone https://github.com/computerguycj/caniusesql.git
cd caniusesql
npm install
npm run generate-sitemap
node generate.js
```

Then serve `dist/` with any static server:
```bash
npx http-server dist/
```

### Adding SQL Commands

1. Edit `data.json` with new commands or update compatibility
2. Re-run `node generate.js`
3. Open a PR

That's it.

## Deployment

Once your PR is merged to `main`, Vercel automatically deploys — the build runs and goes live in seconds. No manual steps needed.

(If you're the repo owner: all changes still flow through PRs, then auto-deploy on merge.)

## Contributing

Found an issue? Have a better description? **Please contribute here** — open an issue or PR instead of forking, so the whole community benefits.

Ways to help:
- **Add or fix SQL commands** in `data.json`
- **Correct compatibility data** (especially edge cases)
- **Report bugs** with specifics
- **Suggest features** in discussions

Big changes? Start with an issue to align on the approach.

### Development Rules

- All changes go through pull requests (no direct pushes to `main`)
- Branch protection keeps `main` stable and prevents accidents
- Review workflow keeps quality high

## License

MIT — use it, modify it, run with it.
