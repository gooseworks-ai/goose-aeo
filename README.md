# Goose AEO

[![npm](https://img.shields.io/npm/v/goose-aeo)](https://www.npmjs.com/package/goose-aeo) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Beta Notice:** This toolkit is currently in beta. APIs and interfaces may change between versions. Please report any issues on [GitHub](https://github.com/gooseworks-ai/goose-aeo/issues).

Open-source Answer Engine Optimization (AEO) toolkit that can be used by AI agents like Claude Code, Codex, Cursor, and [Gooseworks](https://gooseworks.ai).

Track how AI search engines mention your brand, monitor visibility over time, and get actionable recommendations.

Goose AEO queries AI providers (Perplexity, ChatGPT, Gemini, Grok, Claude, DeepSeek) with questions relevant to your product, then analyzes the responses for brand mentions, sentiment, competitor rankings, and citations.

Everything runs locally -- your data stays on your machine in a SQLite database.

<img width="6678" height="4456" alt="image" src="https://github.com/user-attachments/assets/3e14380d-ec5d-4919-9cbf-b932a54f828e" />


## Quick Start

Install the skill and run it in [Claude Code](https://docs.anthropic.com/en/docs/claude-code):

```bash
# Install the AEO skill
npx goose-skills install aeo --claude

# Start Claude Code
claude

# Run the skill
/aeo
```

The `/aeo` skill handles everything interactively -- setup, query generation, running, analysis, and reporting.

You can also use the individual skills directly:

| Command | What it does |
|---------|-------------|
| `/aeo` | Full interactive flow -- setup, run, analyze, and report |
| `/aeo-setup` | Just the setup -- domain, competitors, providers, query generation |
| `/aeo-run` | Just the run -- queries AI engines, analyzes responses, presents report |
| `/aeo-audit` | Scrapes your website and scores each page for AI search readability |
| `/aeo-recommend` | Generates actionable recommendations for improving visibility |

### Using the CLI directly

If you're not using Claude Code, you can run the CLI directly with `npx`:

```bash
npx goose-aeo@latest init
npx goose-aeo@latest queries generate --limit 50
npx goose-aeo@latest run --confirm
npx goose-aeo@latest analyze
npx goose-aeo@latest report
npx goose-aeo@latest dashboard
```

### Production on Google Cloud Run

For a small, cost-safe production setup with:
- public dashboard deployment,
- weekly Thursday automation (`queries generate` + `run` + `analyze` + `audit`),
- persistent shared data storage,

use the runbook at [`docs/deploy-cloud-run-weekly.md`](docs/deploy-cloud-run-weekly.md).

## What You'll Need

- **Node.js >= 20**
- **At least one AI provider API key** (see table below)
- **An OpenAI API key for analysis** (used to analyze responses for brand mentions -- can use any provider, but OpenAI is the default)

| Provider   | Default Model          | Env Var                        |
| ---------- | ---------------------- | ------------------------------ |
| Perplexity | sonar-pro              | `GOOSE_AEO_PERPLEXITY_API_KEY` |
| OpenAI     | gpt-5.4                | `GOOSE_AEO_OPENAI_API_KEY`     |
| Gemini     | gemini-3-flash-preview | `GOOSE_AEO_GEMINI_API_KEY`     |
| Grok       | grok-4.20              | `GOOSE_AEO_GROK_API_KEY`       |
| Claude     | claude-sonnet-4-6      | `GOOSE_AEO_CLAUDE_API_KEY`     |
| DeepSeek   | deepseek-v4            | `GOOSE_AEO_DEEPSEEK_API_KEY`   |

Set keys in a `.env` file in your working directory or export them in your shell.

## How It Works

1. **`init`** -- Creates a `.goose-aeo.yml` config and a local SQLite database. Optionally scrapes your site (via Firecrawl) to auto-detect your company description and competitors.
2. **`queries generate`** -- Uses AI to generate search queries that a potential customer might ask, relevant to your product category.
3. **`run`** -- Sends those queries to each AI provider and stores the raw responses. Shows a cost estimate before calling APIs.
4. **`analyze`** -- Parses each response for brand mentions, prominence, sentiment, citations, and competitor rankings.
5. **`report`** -- Prints a summary: visibility rate, prominence score, share of voice, and per-competitor breakdown.
6. **`dashboard`** -- Launches a local web UI with charts, response drilldowns, and run history.

## Gotchas

- **Cost**: Each `run` calls real AI APIs. A run with 50 queries across 5 providers makes 250 API calls. Use `--dry-run` to see the estimated cost before committing. A typical run costs $5-20 depending on providers and query count.
- **Rate limits**: Some providers (especially Perplexity and Grok) have aggressive rate limits. The tool handles retries, but if you're on a free tier you may hit limits quickly. Use `--concurrency 1` to slow things down.
- **Analysis needs an LLM**: The `analyze` step uses an LLM (OpenAI by default) to parse responses. This is a separate cost from the provider queries. You can change the analysis model in `.goose-aeo.yml`.
- **Results vary**: AI responses are non-deterministic. Your visibility score will fluctuate between runs even if nothing changes on your end. Look at trends over multiple runs, not single data points.
- **Local only**: All data is stored in a local SQLite file. There's no cloud sync, no account, no telemetry. If you delete the `.db` file, your history is gone.
- **Query quality matters**: The auto-generated queries are a starting point. Review them with `queries list` and add/remove queries to match what your actual customers ask. Better queries = more meaningful results.

## This Is Not a Replacement for Dedicated AEO Tools

Goose AEO is a free, open-source starting point for understanding your AI search visibility. It's great for getting a quick baseline, running ad-hoc checks, and understanding the landscape. And it's designed to be used by AI agents like Claude Code and [Gooseworks](https://gooseworks.ai).

However, if you're serious about AEO as a channel, dedicated tools offer capabilities that are hard to replicate in an open-source CLI:

- **[Profound](https://www.tryprofound.com/)**
- **[Otterly](https://www.otterly.ai/)**
- **[Daydream](https://www.withdaydream.com/)**
- **[Gauge](http://withgauge.com/)**

These tools provide more realistic representations of AI visibility as they can simulate real browser usage instead of API calls (like we are doing here), as well as running simulations with different locations and configurations.

## CLI Reference

All commands support `--json` for machine-readable output and `--config <path>` for a custom config file location.

### `goose-aeo init`

Initialize config and database for a domain.

```
--domain <domain>           Company domain (e.g. example.com)
--name <name>               Company name
--providers <list>          Comma-separated provider IDs
--query-limit <number>      Max queries (1-500, default 100)
--db-path <path>            Database path (default ./goose-aeo.db)
--description <text>        Company description
--competitors <domains>     Comma-separated competitor domains
```

### `goose-aeo queries`

```bash
goose-aeo queries generate   # Generate queries with AI
  --limit <number>            # How many queries
  --model <model>             # Model for generation
  --dry-run                   # Preview without saving

goose-aeo queries list        # List active queries
goose-aeo queries add <text>  # Add a query manually
goose-aeo queries remove <id> # Deprecate a query
```

### `goose-aeo run`

Run AI provider checks against your active queries.

```
--providers <list>          Override which providers to query
--queries <ids>             Run specific query IDs only
--query-limit <number>      Override query limit for this run
--confirm                   Skip confirmation prompt
--budget-limit <usd>        Cap spend in USD
--concurrency <number>      Parallel API call concurrency
--dry-run                   Estimate cost without calling APIs
--no-estimate               Skip pre-run cost estimate
```

### `goose-aeo analyze`

Analyze provider responses from a run for brand mentions, sentiment, and ranking.

```
--run <runId>               Run ID (defaults to latest)
--model <model>             Override analysis model
--reanalyze                 Re-analyze even if results exist
```

### `goose-aeo report`

Display a run report with visibility, prominence, and share-of-voice metrics.

```
--run <runId>               Run ID (defaults to latest)
--compare <runId>           Compare against another run
--format <format>           table | json | markdown
```

### `goose-aeo diff`

Compare metrics between two runs.

```
--run1 <runId>              First run ID (required)
--run2 <runId>              Second run ID (required)
```

### `goose-aeo costs`

Show cost history across runs.

```
--last <number>             Show last N runs (default 10)
```

### `goose-aeo status`

Show current database state: company, query count, run count, latest run.

### `goose-aeo dashboard`

Start a local web dashboard with charts and run details.

```
--port <port>               Port number (default 3847)
--no-open                   Don't auto-open browser
--pricing-config <path>     Custom pricing config path
```

## Configuration

The `.goose-aeo.yml` file is created during `init`. Key fields:

```yaml
domain: example.com
name: Example Inc
description: What your company does

competitors:
  - domain: competitor1.com
    name: Competitor 1

providers:
  - id: perplexity
    model: sonar-pro
  - id: openai
    model: gpt-5.4

analysis:
  provider: openai
  model: gpt-5.4

query_limit: 100
db_path: ./goose-aeo.db
budget_limit_usd: null
```

Optional: set `GOOSE_AEO_FIRECRAWL_API_KEY` to auto-fetch your company description during `init`.

## Development

```bash
git clone https://github.com/gooseworks-ai/goose-aeo.git
cd goose-aeo
npm install
npm run build
npm run test
```

## Project Structure

```
goose-aeo/
├── packages/
│   ├── core/          # Business logic, DB, providers, services
│   ├── cli/           # CLI commands (published as `goose-aeo` on npm)
│   └── ui/            # Dashboard React components
├── apps/
│   └── dashboard/     # Express API + Vite React app
├── pricing.json       # Provider pricing data
└── turbo.json         # Turborepo config
```

## License

MIT
