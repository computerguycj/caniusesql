# caniusesql.com

> The definitive SQL compatibility reference. Stop guessing. Start building.

A caniuse.com-style resource for checking SQL feature support across PostgreSQL, MySQL, SQLite, SQL Server, and Oracle.

**[Try it live →](https://www.caniusesql.com)**
<img width="1092" height="829" alt="image" src="https://github.com/user-attachments/assets/5150ebd1-2452-40ae-9d91-2d691bcc225b" />

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

The build step (`npm run build`: `node generate.js`, then `vite build` for the Vue custom elements) reads your data and generates:
- Individual pages for each SQL command
- Homepage with full index
- Sitemap for search engines
- API functions that log views and return trending commands

No build toolchain complexity. No client-side rendering delays.

## MCP Server

The same data is available to AI assistants through a [Model Context Protocol](https://modelcontextprotocol.io) server, so an assistant can look up compatibility instead of answering from memory. It's a C# console app (`server/src/CanIUseSql.Mcp`) built on the official MCP C# SDK. It runs locally over stdio and reads the same `data.json` as the site.

It has two tools, meant to be used in order:

- `search_commands(query, limit?)` finds commands by keyword and returns each one's slug.
- `check_compatibility(slug, dialects?)` returns support for that command per database: since which version, dialect-specific syntax, notes, and a workaround where one exists.

To use it with Claude Code (needs the .NET 10 SDK), build it from the repo root:

```bash
dotnet build server/src/CanIUseSql.Mcp
```

Then register it, replacing the path with your clone's full path:

```bash
claude mcp add caniusesql --scope user -- dotnet run --no-build --project /full/path/to/caniusesql/server/src/CanIUseSql.Mcp
```

Start a new session and ask something like "can I use MERGE in Oracle?".

## Getting Started

### Local Setup

```bash
git clone https://github.com/computerguycj/caniusesql.git
cd caniusesql
npm install
npm run generate-sitemap
npm run build
```

Then serve `dist/` with any static server:
```bash
npx http-server dist/
```

### Adding SQL Commands

1. Edit `data.json` with new commands or update compatibility
2. Re-run `npm run build` and `npm test`
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
