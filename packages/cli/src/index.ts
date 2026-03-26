import 'dotenv/config'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import openBrowser from 'open'
import {
  AEOClient,
  bootstrapDomainContext,
  initProject,
  type ProviderId,
  type RunCreateOptions,
} from '@goose-aeo/core'
import { getBanner } from './banner.js'

const program = new Command()

const asList = (value?: string): string[] => {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const toProviderIds = (value?: string): ProviderId[] => {
  return asList(value) as ProviderId[]
}

const printJson = (payload: unknown): void => {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

const printTable = (rows: string[][]): void => {
  if (rows.length === 0) {
    return
  }

  const firstRow = rows[0] ?? []
  const widths = firstRow.map((_, colIndex) =>
    Math.max(...rows.map((row) => (row[colIndex] ?? '').length)),
  )

  for (const row of rows) {
    const line = row
      .map((value, index) => value.padEnd(widths[index] ?? value.length))
      .join('  ')
    process.stdout.write(`${line}\n`)
  }
}

const fail = (error: unknown, json: boolean): never => {
  const message = error instanceof Error ? error.message : String(error)
  if (json) {
    printJson({ status: 'error', error: message })
  } else {
    process.stderr.write(`Error: ${message}\n`)
  }

  process.exit(1)
}

const resolveGooseAeoWorkspaceRoot = (): string => {
  const currentFile = fileURLToPath(import.meta.url)
  return path.resolve(path.dirname(currentFile), '../../..')
}

const updateEnvFile = (cwd: string, updates: Record<string, string>) => {
  const envPath = path.resolve(cwd, '.env')
  const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''

  const additions: string[] = []
  for (const [key, value] of Object.entries(updates)) {
    if (!value || current.includes(`${key}=`)) {
      continue
    }

    additions.push(`${key}=${value}`)
  }

  if (additions.length > 0) {
    appendFileSync(envPath, `\n${additions.join('\n')}\n`)
  }
}

program
  .name('goose-aeo')
  .description('Goose AEO CLI')
  .version('0.1.0')
  .addHelpText('beforeAll', getBanner())

program
  .command('init')
  .description('Initialize Goose AEO config and SQLite DB')
  .option('--domain <domain>')
  .option('--name <name>')
  .option('--providers <providers>', 'comma-separated provider IDs')
  .option('--query-limit <number>', 'query limit', Number)
  .option('--db-path <path>', 'database path')
  .option('--description <description>', 'company description')
  .option('--competitors <domains>', 'comma-separated competitor domains')
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config file path')
  .action(async (options) => {
    const json = Boolean(options.json)

    try {
      let domain = options.domain as string | undefined
      let name = options.name as string | undefined
      let description = options.description as string | undefined
      const providerIds = toProviderIds(options.providers)
      let competitors = asList(options.competitors).map((entry) => ({ domain: entry }))

      if (!domain && json) {
        throw new Error('`--domain` is required in --json mode')
      }

      if (!domain && !process.stdin.isTTY) {
        throw new Error('`--domain` is required in non-interactive mode')
      }

      if (!domain) {
        const answers = await inquirer.prompt<{ domain: string; name: string }>([
          { type: 'input', name: 'domain', message: 'Company domain (e.g., athina.ai):' },
          { type: 'input', name: 'name', message: 'Company name:' },
        ])

        domain = answers.domain
        name = answers.name
      }

      if (!name) {
        name = domain?.split('.')[0] ?? 'Company'
      }

      if (!description || competitors.length === 0) {
        const bootstrap = await bootstrapDomainContext({
          domain: domain!,
          firecrawlApiKey: process.env.GOOSE_AEO_FIRECRAWL_API_KEY,
          openAiApiKey: process.env.GOOSE_AEO_OPENAI_API_KEY,
        })

        description = description ?? bootstrap.description
        if (competitors.length === 0) {
          competitors = bootstrap.competitors
        }
      }

      if (!json && process.stdin.isTTY) {
        const defaultProviders: ProviderId[] = ['perplexity', 'openai', 'gemini']
        const selectedProviders =
          providerIds.length > 0
            ? providerIds
            : defaultProviders

        const envVarForProvider: Record<ProviderId, string> = {
          perplexity: 'GOOSE_AEO_PERPLEXITY_API_KEY',
          openai: 'GOOSE_AEO_OPENAI_API_KEY',
          gemini: 'GOOSE_AEO_GEMINI_API_KEY',
          grok: 'GOOSE_AEO_GROK_API_KEY',
          claude: 'GOOSE_AEO_CLAUDE_API_KEY',
          deepseek: 'GOOSE_AEO_DEEPSEEK_API_KEY',
        }

        const missingProviderKeys = selectedProviders
          .map((provider) => envVarForProvider[provider])
          .filter((key) => !process.env[key])

        const promptFields = missingProviderKeys.map((key) => ({
          type: 'password' as const,
          name: key,
          message: `Enter ${key} (optional):`,
        }))

        if (!process.env.GOOSE_AEO_FIRECRAWL_API_KEY) {
          promptFields.push({
            type: 'password',
            name: 'GOOSE_AEO_FIRECRAWL_API_KEY',
            message: 'Enter GOOSE_AEO_FIRECRAWL_API_KEY (optional):',
          })
        }

        if (promptFields.length > 0) {
          const envAnswers = await inquirer.prompt<Record<string, string>>(promptFields)
          updateEnvFile(process.cwd(), envAnswers)
        }
      }

      const result = await initProject({
        cwd: process.cwd(),
        configPath: options.config as string | undefined,
        domain: domain!,
        name,
        description,
        providers: providerIds.length > 0 ? providerIds : undefined,
        queryLimit: options.queryLimit,
        dbPath: options.dbPath,
        competitors,
      })

      if (json) {
        printJson({ status: 'success', ...result })
        return
      }

      process.stdout.write(`Initialized Goose AEO for ${result.domain}\n`)
      process.stdout.write(`Config: ${result.configPath}\nDB: ${result.dbPath}\nPricing: ${result.pricingPath}\n`)
    } catch (error) {
      fail(error, json)
    }
  })

const queriesCommand = program.command('queries').description('Manage query library')

queriesCommand
  .command('generate')
  .description('Generate query library')
  .option('--limit <number>', 'query limit', Number)
  .option('--model <model>', 'model for generation')
  .option('--dry-run', 'do not persist generated queries', false)
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({
      cwd: process.cwd(),
      configPath: options.config,
    })

    try {
      const spinner = json ? null : ora('Generating queries...').start()
      const result = await client.queries.generate({
        limit: options.limit,
        model: options.model,
        dryRun: options.dryRun,
      })
      spinner?.stop()

      if (json) {
        printJson(result)
        return
      }

      process.stdout.write(`Generated ${result.queries.length} queries${result.saved ? ` (version ${result.version})` : ''}\n`)
      result.queries.forEach((query, index) => {
        process.stdout.write(`${index + 1}. ${query}\n`)
      })
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

queriesCommand
  .command('list')
  .description('List active queries')
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({
      cwd: process.cwd(),
      configPath: options.config,
    })

    try {
      const rows = await client.queries.listActive()
      if (json) {
        printJson(rows)
        return
      }

      printTable([
        ['ID', 'VERSION', 'QUERY'],
        ...rows.map((row) => [row.id, String(row.version), row.text]),
      ])
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

queriesCommand
  .command('add')
  .description('Add a query manually')
  .argument('<text>', 'query text')
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (text: string, options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({ cwd: process.cwd(), configPath: options.config })

    try {
      const result = await client.queries.add(text)
      if (json) {
        printJson(result)
        return
      }

      process.stdout.write(`Added query ${result.id}\n`)
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

queriesCommand
  .command('remove')
  .description('Deprecate a query')
  .argument('<id>', 'query id')
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (id: string, options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({ cwd: process.cwd(), configPath: options.config })

    try {
      const removed = await client.queries.remove(id)
      if (json) {
        printJson({ id, removed })
        return
      }

      process.stdout.write(removed ? `Removed ${id}\n` : `No active query found for ${id}\n`)
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

program
  .command('run')
  .description('Run provider checks against active queries')
  .option('--providers <providers>', 'comma-separated provider IDs')
  .option('--queries <queryIds>', 'comma-separated query IDs')
  .option('--query-limit <number>', 'query limit for this run', Number)
  .option('--confirm', 'skip confirmation prompt', false)
  .option('--budget-limit <usd>', 'budget cap in USD', Number)
  .option('--concurrency <number>', 'parallel provider call concurrency', Number)
  .option('--dry-run', 'estimate only, no API calls', false)
  .option('--no-estimate', 'skip pre-run estimate display')
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({ cwd: process.cwd(), configPath: options.config })

    const runOptions: RunCreateOptions = {
      providers: toProviderIds(options.providers),
      queryIds: asList(options.queries),
      queryLimit: options.queryLimit,
      confirm: options.confirm,
      budgetLimitUsd: options.budgetLimit,
      concurrency: options.concurrency,
      dryRun: options.dryRun,
      noEstimate: options.estimate === false,
    }

    try {
      if (!runOptions.noEstimate && !runOptions.dryRun) {
        const preview = await client.runs.create({
          ...runOptions,
          dryRun: true,
        })

        if (!json) {
          process.stdout.write('Goose AEO — Run Estimate\n')
          process.stdout.write(`Queries: ${preview.estimate.queries}\n`)
          process.stdout.write(`Providers: ${preview.estimate.providers.join(', ')}\n`)
          process.stdout.write(`Total API calls: ${preview.estimate.totalApiCalls}\n`)
          process.stdout.write(`Estimated total: $${preview.estimate.totalUsd.toFixed(2)}\n`)
        }

        if (preview.summary.status === 'aborted') {
          if (json) {
            printJson(preview)
          } else {
            process.stdout.write(`Aborted: ${preview.summary.errors.join('; ')}\n`)
          }
          return
        }

        if (!options.confirm && !json) {
          const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
            {
              type: 'confirm',
              name: 'proceed',
              message: 'Proceed with run?',
              default: true,
            },
          ])

          if (!proceed) {
            process.stdout.write('Run cancelled.\n')
            return
          }
        }
      }

      const spinner = json ? null : ora('Running queries against providers...').start()
      const result = await client.runs.create(runOptions)
      spinner?.stop()

      if (json) {
        printJson(result)
        return
      }

      process.stdout.write(`Run complete — ${result.summary.runId}\n`)
      process.stdout.write(`Status: ${result.summary.status}\n`)
      process.stdout.write(`Duration: ${result.summary.durationSeconds}s\n`)
      process.stdout.write(`Actual cost: $${result.summary.actualCostUsd.toFixed(2)}\n`)

      if (result.summary.errors.length > 0) {
        process.stdout.write(`Errors (${result.summary.errors.length}):\n`)
        result.summary.errors.slice(0, 10).forEach((error) => {
          process.stdout.write(`- ${error}\n`)
        })
      }
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

program
  .command('analyze')
  .description('Analyze run provider responses')
  .option('--run <runId>', 'run id (default latest)')
  .option('--model <model>', 'analysis model')
  .option('--reanalyze', 'reanalyze even if records exist', false)
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({ cwd: process.cwd(), configPath: options.config })

    try {
      const spinner = json ? null : ora('Analyzing responses...').start()
      const result = await client.analyze({
        runId: options.run,
        model: options.model,
        reanalyze: options.reanalyze,
      })
      spinner?.stop()

      if (json) {
        printJson(result)
        return
      }

      process.stdout.write(`Analyzed run ${result.runId}\n`)
      process.stdout.write(`Inserted: ${result.inserted}, skipped: ${result.skipped}, failed: ${result.failed}\n`)
      process.stdout.write(`Analysis cost: $${result.analysisCostUsd.toFixed(4)}\n`)
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

program
  .command('report')
  .description('Show run report')
  .option('--run <runId>', 'run id')
  .option('--compare <runId>', 'compare against another run')
  .option('--format <format>', 'table|json|markdown', 'table')
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (options) => {
    const json = Boolean(options.json) || options.format === 'json'
    const client = await AEOClient.create({ cwd: process.cwd(), configPath: options.config })

    try {
      const spinner = json ? null : ora('Generating report...').start()
      const report = await client.report({
        runId: options.run,
        compareRunId: options.compare,
      })
      spinner?.stop()

      if (json) {
        printJson(report)
        return
      }

      if (options.format === 'markdown') {
        process.stdout.write(`# Goose AEO Report — ${report.domain}\n\n`)
        process.stdout.write(`Run: ${report.runId}\n\n`)
        process.stdout.write('## Overall Metrics\n')
        Object.entries(report.metrics).forEach(([metric, value]) => {
          process.stdout.write(`- ${metric}: ${value}\n`)
        })
        return
      }

      process.stdout.write(`Goose AEO Report — ${report.domain} — ${report.generatedAt}\n`)
      printTable([
        ['Metric', 'Value'],
        ...Object.entries(report.metrics).map(([metric, value]) => [metric, value.toFixed(4)]),
      ])

      if (report.providerMetrics.length > 0) {
        process.stdout.write('\nBy Provider\n')
        for (const row of report.providerMetrics) {
          process.stdout.write(`${row.provider}\n`)
          printTable([
            ['Metric', 'Value'],
            ...Object.entries(row.metrics).map(([metric, value]) => [metric, value.toFixed(4)]),
          ])
          process.stdout.write('\n')
        }
      }
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

program
  .command('diff')
  .description('Compare two runs')
  .requiredOption('--run1 <runId>', 'first run id')
  .requiredOption('--run2 <runId>', 'second run id')
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({ cwd: process.cwd(), configPath: options.config })

    try {
      const diff = await client.diff(options.run1, options.run2)
      if (json) {
        printJson(diff)
        return
      }

      printTable([
        ['Provider', 'Metric', 'Run1', 'Run2', 'Delta'],
        ...diff.deltas.map((delta) => [
          delta.provider ?? 'all',
          delta.metric,
          delta.run1?.toFixed(4) ?? 'n/a',
          delta.run2?.toFixed(4) ?? 'n/a',
          delta.delta?.toFixed(4) ?? 'n/a',
        ]),
      ])
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

program
  .command('costs')
  .description('Show cost history')
  .option('--last <number>', 'how many recent runs', Number, 10)
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({ cwd: process.cwd(), configPath: options.config })

    try {
      const costs = await client.costs(options.last)
      if (json) {
        printJson(costs)
        return
      }

      printTable([
        ['Run', 'Date', 'Estimated', 'Actual', 'Queries', 'Providers'],
        ...costs.runs.map((run) => [
          run.runId,
          run.date,
          `$${run.estimated.toFixed(2)}`,
          `$${run.actual.toFixed(2)}`,
          String(run.queries),
          String(run.providers),
        ]),
      ])

      process.stdout.write(`\nAll-time actual: $${costs.allTimeActual.toFixed(2)} (${costs.totalRuns} runs)\n`)
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

program
  .command('status')
  .description('Show machine-readable local DB state')
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({ cwd: process.cwd(), configPath: options.config })

    try {
      const status = await client.status()
      if (json) {
        printJson(status)
        return
      }

      process.stdout.write(`Company: ${status.company}\n`)
      process.stdout.write(`Queries: ${status.totalQueries}\n`)
      process.stdout.write(`Runs: ${status.totalRuns}\n`)
      if (status.latestRun) {
        process.stdout.write(`Latest run: ${status.latestRun.id} (${status.latestRun.status})\n`)
      }
      process.stdout.write(`DB: ${status.dbPath} (${status.dbSizeMb} MB)\n`)
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

program
  .command('dashboard')
  .description('Start local dashboard server')
  .option('--port <port>', 'port number', Number, 3847)
  .option('--no-open', 'do not auto-open browser')
  .option('--config <path>', 'config path')
  .option('--pricing-config <path>', 'pricing config path')
  .action(async (options) => {
    try {
      // Resolve static assets: check bundled location first, then monorepo fallback
      const cliDir = path.dirname(fileURLToPath(import.meta.url))
      let staticRoot = path.resolve(cliDir, 'public')

      if (!existsSync(staticRoot)) {
        const workspaceRoot = resolveGooseAeoWorkspaceRoot()
        const isMonorepo = existsSync(path.resolve(workspaceRoot, 'turbo.json'))

        if (isMonorepo) {
          const dashboardRoot = path.resolve(workspaceRoot, 'apps/dashboard')
          const monorepoStatic = path.resolve(dashboardRoot, 'dist/public')

          if (!existsSync(monorepoStatic)) {
            process.stdout.write('Building dashboard assets...\n')
            const buildResult = spawnSync(
              'npm',
              ['run', 'build', '--workspace', 'goose-aeo-dashboard'],
              {
                cwd: workspaceRoot,
                stdio: 'inherit',
              },
            )

            if (buildResult.status !== 0) {
              process.stdout.write('Warning: Could not build dashboard UI. API endpoints will still be available.\n')
            }
          }

          if (existsSync(monorepoStatic)) {
            staticRoot = monorepoStatic
          }
        } else {
          process.stdout.write('Dashboard UI assets not found. API endpoints will still be available.\n')
          process.stdout.write('If developing locally, run `npm run build` from the monorepo root first.\n')
        }
      }

      const { startDashboardServer } = await import('./dashboard-server.js')

      const explicitConfig = options.config as string | undefined
      const configFile = explicitConfig
        ? path.resolve(process.cwd(), explicitConfig)
        : path.resolve(process.cwd(), '.goose-aeo.yml')
      const dataCwd = existsSync(configFile) ? path.dirname(configFile) : process.cwd()

      await startDashboardServer({
        port: options.port,
        configPath: explicitConfig,
        pricingPath: options.pricingConfig as string | undefined,
        dataCwd,
        staticRoot,
      })

      const url = `http://localhost:${options.port}`
      if (options.open !== false) {
        await openBrowser(url)
      }

      process.stdout.write(`Dashboard ready at ${url}\n`)
    } catch (error) {
      fail(error, false)
    }
  })

program
  .command('audit')
  .description('Audit website pages for AI search readability')
  .option('--pages <number>', 'max pages to audit', Number)
  .option('--model <model>', 'LLM model for scoring')
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({ cwd: process.cwd(), configPath: options.config })

    try {
      const result = await client.audit({
        maxPages: options.pages,
        model: options.model,
      })

      if (json) {
        printJson(result)
        return
      }

      process.stdout.write(`Audit complete: ${result.overallScore}/10 (${result.pages.length} pages)\n`)
      for (const page of result.pages) {
        process.stdout.write(`  ${page.overallScore.toFixed(1)} ${page.url}\n`)
      }
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

program
  .command('recommend')
  .description('Generate AI visibility recommendations')
  .option('--json', 'machine-readable output', false)
  .option('--config <path>', 'config path')
  .action(async (options) => {
    const json = Boolean(options.json)
    const client = await AEOClient.create({ cwd: process.cwd(), configPath: options.config })

    try {
      const result = await client.recommend()

      if (json) {
        printJson(result)
        return
      }

      process.stdout.write(`${result.summary}\n\n`)
      process.stdout.write(`Visibility gaps: ${result.visibilityGaps.length}\n`)
      process.stdout.write(`Source opportunities: ${result.sourceOpportunities.length}\n`)
      process.stdout.write(`Competitor insights: ${result.competitorInsights.length}\n`)
    } catch (error) {
      fail(error, json)
    } finally {
      client.close()
    }
  })

program.parseAsync(process.argv).catch((error) => {
  fail(error, false)
})
