# Goose AEO

Open-source Answer Engine Optimization (AEO) toolkit. Track how AI search engines mention your brand, monitor visibility over time, and get actionable recommendations.

Goose AEO queries AI providers (Perplexity, ChatGPT, Gemini, Grok, Claude, DeepSeek) with questions relevant to your product, then analyzes the responses for brand mentions, sentiment, competitor rankings, and citations. Everything runs locally -- your data stays on your machine in a SQLite database.

## Quick Start

```bash
# Initialize for your domain (interactive -- prompts for API keys)
npx goose-aeo init

# Generate search queries, run them, analyze, and view a report
npx goose-aeo queries generate --limit 50
npx goose-aeo run --confirm
npx goose-aeo analyze
npx goose-aeo report

# Open the local dashboard
npx goose-aeo dashboard
```

That's it. Five commands to go from zero to a full AEO report.

## What You'll Need

- **Node.js >= 20**
- **At least one AI provider API key** (see table below)
- **An OpenAI API key for analysis** (used to analyze responses for brand mentions -- can use any provider, but OpenAI is the default)

| Provider   | Default Model      | Env Var |
|------------|-------------------|---------|
| Perplexity | sonar-pro         | `GOOSE_AEO_PERPLEXITY_API_KEY` |
| OpenAI     | gpt-4o            | `GOOSE_AEO_OPENAI_API_KEY` |
| Gemini     | gemini-2.0-flash  | `GOOSE_AEO_GEMINI_API_KEY` |
| Grok       | grok-3            | `GOOSE_AEO_GROK_API_KEY` |
| Claude     | claude-sonnet-4-6 | `GOOSE_AEO_CLAUDE_API_KEY` |
| DeepSeek   | deepseek-chat     | `GOOSE_AEO_DEEPSEEK_API_KEY` |

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

Goose AEO is a free, open-source starting point for understanding your AI search visibility. It's great for getting a quick baseline, running ad-hoc checks, and understanding the landscape.

However, if you're serious about AEO as a channel, dedicated tools offer capabilities that are hard to replicate in an open-source CLI:

- **[Profound](https://www.profound.so/)** -- Enterprise-grade AI search analytics with continuous monitoring, competitive intelligence, and actionable optimization recommendations at scale.
- **[Otterly](https://www.otterly.ai/)** -- AI search monitoring platform with automated tracking, brand mention analysis, and share-of-voice dashboards across AI engines.
- **[Daydream](https://daydream.co/)** -- AI-powered content optimization platform that helps you create and optimize content specifically for AI search visibility.
- **[Gauge](https://www.gauge.co/)** -- AI visibility monitoring with automated alerts, competitive benchmarking, and integration with your existing marketing stack.

These tools provide continuous monitoring, team collaboration, historical trend analysis at scale, integrations with your marketing stack, and expert support. If AEO is a meaningful part of your growth strategy, you should probably be using one of them.

Goose AEO is best for: developers who want to understand AEO, teams evaluating whether to invest in the space, and anyone who wants full control over their data and methodology.

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
--no-alerts                 Skip alert dispatch
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

### `goose-aeo schedule`

```bash
goose-aeo schedule set --frequency daily    # or weekly
goose-aeo schedule set --cron "0 9 * * 1"   # custom cron
goose-aeo schedule status                    # show current schedule
goose-aeo schedule remove                    # remove schedule
```

### `goose-aeo mcp`

Start an MCP (Model Context Protocol) stdio server for integration with Claude Code and other AI tools.

Exposed tools: `aeo_status`, `aeo_run`, `aeo_report`, `aeo_diff`, `aeo_costs`, `aeo_list_queries`.

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
    model: gpt-4o

analysis:
  provider: openai
  model: gpt-4o-mini

query_limit: 100
db_path: ./goose-aeo.db
budget_limit_usd: null

alerts:
  visibility_rate_drop: 0.05
  prominence_score_drop: 0.1
  share_of_voice_drop: 0.02
```

### Alert Configuration (Optional)

```
GOOSE_AEO_ALERT_SLACK_WEBHOOK_URL=    # Slack alerts on metric drops
GOOSE_AEO_ALERT_EMAIL_TO=             # Email recipient for alerts
GOOSE_AEO_ALERT_EMAIL_FROM=           # Email sender address
GOOSE_AEO_SMTP_HOST=
GOOSE_AEO_SMTP_PORT=
GOOSE_AEO_SMTP_USER=
GOOSE_AEO_SMTP_PASS=
```

Optional: set `GOOSE_AEO_FIRECRAWL_API_KEY` to auto-fetch your company description during `init`.

## Development

```bash
git clone https://github.com/athina-ai/goose-aeo.git
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
