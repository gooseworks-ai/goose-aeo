import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { AEOClient } from '@goose-aeo/core'

interface ServerOptions {
  port?: number
  configPath?: string
  pricingPath?: string
  dataCwd?: string
  appRoot?: string
}

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

const parseBasicAuthHeader = (headerValue: string | undefined): { username: string; password: string } | null => {
  if (!headerValue || !headerValue.startsWith('Basic ')) {
    return null
  }

  const encoded = headerValue.slice('Basic '.length).trim()
  if (!encoded) {
    return null
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  const separatorIndex = decoded.indexOf(':')
  if (separatorIndex < 0) {
    return null
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  }
}

const parseIntParam = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const withClient = async <T>(options: ServerOptions, fn: (client: AEOClient) => Promise<T>): Promise<T> => {
  const client = await AEOClient.create({
    cwd: options.dataCwd ?? process.cwd(),
    configPath: options.configPath,
    pricingPath: options.pricingPath,
  })

  try {
    return await fn(client)
  } finally {
    client.close()
  }
}

export async function startDashboardServer(options: ServerOptions = {}) {
  const app = express()
  const port = options.port ?? 3847
  const basicAuthUser = process.env.GOOSE_AEO_DASHBOARD_BASIC_AUTH_USER
  const basicAuthPassword = process.env.GOOSE_AEO_DASHBOARD_BASIC_AUTH_PASSWORD
  const allowedEmailDomain = process.env.GOOSE_AEO_DASHBOARD_ALLOWED_EMAIL_DOMAIN
    ?.trim()
    .replace(/^@+/, '')
    .toLowerCase()
  const sharedPassword = process.env.GOOSE_AEO_DASHBOARD_SHARED_PASSWORD
  const basicAuthEnabled = Boolean(
    (basicAuthUser && basicAuthPassword) || (allowedEmailDomain && sharedPassword),
  )
  const appRoot =
    options.appRoot ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

  if (basicAuthEnabled) {
    app.use((req, res, next) => {
      if (req.path === '/healthz') {
        next()
        return
      }

      const parsed = parseBasicAuthHeader(req.headers.authorization)
      if (parsed) {
        if (allowedEmailDomain && sharedPassword) {
          const normalizedUser = parsed.username.trim().toLowerCase()
          const domainMatch = normalizedUser.endsWith(`@${allowedEmailDomain}`)
          if (domainMatch && timingSafeEqual(parsed.password, sharedPassword)) {
            next()
            return
          }
        } else if (
          basicAuthUser &&
          basicAuthPassword &&
          timingSafeEqual(parsed.username, basicAuthUser) &&
          timingSafeEqual(parsed.password, basicAuthPassword)
        ) {
          next()
          return
        }
      }

      res.setHeader('WWW-Authenticate', 'Basic realm="Goose AEO Dashboard"')
      res.status(401).json({ error: 'Authentication required' })
    })
  }

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true })
  })

  app.get('/api/status', async (_req, res) => {
    try {
      const payload = await withClient(options, (client) => client.status())
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/runs', async (req, res) => {
    try {
      const payload = await withClient(options, (client) =>
        client.dashboard.runs({
          limit: parseIntParam(req.query.limit as string | undefined, 20),
          offset: parseIntParam(req.query.offset as string | undefined, 0),
        }),
      )
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/runs/:id', async (req, res) => {
    try {
      const payload = await withClient(options, (client) => client.dashboard.run(req.params.id))
      if (!payload) {
        res.status(404).json({ error: 'Run not found' })
        return
      }

      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/runs/:id/metrics', async (req, res) => {
    try {
      const payload = await withClient(options, (client) => client.dashboard.metrics(req.params.id))
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/runs/:id/results', async (req, res) => {
    try {
      const payload = await withClient(options, (client) =>
        client.dashboard.results({
          runId: req.params.id,
          provider: req.query.provider as string | undefined,
          queryId: req.query.query_id as string | undefined,
          limit: parseIntParam(req.query.limit as string | undefined, 100),
          offset: parseIntParam(req.query.offset as string | undefined, 0),
        }),
      )
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/queries', async (_req, res) => {
    try {
      const payload = await withClient(options, (client) => client.dashboard.queries())
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/diff', async (req, res) => {
    const run1 = req.query.run1 as string | undefined
    const run2 = req.query.run2 as string | undefined
    if (!run1 || !run2) {
      res.status(400).json({ error: 'run1 and run2 are required' })
      return
    }

    try {
      const payload = await withClient(options, (client) => client.diff(run1, run2))
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/costs', async (req, res) => {
    try {
      const payload = await withClient(options, (client) =>
        client.costs(parseIntParam(req.query.last as string | undefined, 10)),
      )
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/query-visibility', async (_req, res) => {
    try {
      const payload = await withClient(options, (client) => client.dashboard.queryVisibility())
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/trends', async (req, res) => {
    try {
      const metric = (req.query.metric as string) ?? 'visibility_rate'
      const last = parseIntParam(req.query.last as string | undefined, 10)
      const payload = await withClient(options, (client) => client.dashboard.trends(metric, last))
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/runs/:id/competitors', async (req, res) => {
    try {
      const payload = await withClient(options, (client) => client.dashboard.competitors(req.params.id))
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/runs/:id/citations', async (req, res) => {
    try {
      const payload = await withClient(options, (client) => client.dashboard.citations(req.params.id))
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/runs/:id/recommendations', async (req, res) => {
    try {
      const payload = await withClient(options, (client) => client.dashboard.recommendations(req.params.id))
      if (!payload) {
        res.json({ error: 'No recommendations found for this run' })
        return
      }
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/audits', async (_req, res) => {
    try {
      const payload = await withClient(options, (client) => client.dashboard.audits())
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/audits/:id', async (req, res) => {
    try {
      const payload = await withClient(options, (client) => client.dashboard.audit(req.params.id))
      if (!payload) {
        res.status(404).json({ error: 'Audit not found' })
        return
      }
      res.json(payload)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  const staticRoot = path.resolve(appRoot, 'dist/public')
  if (existsSync(staticRoot)) {
    app.use(express.static(staticRoot))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticRoot, 'index.html'))
    })
  } else {
    app.get('*', (_req, res) => {
      res.type('html').send('<h1>Goose AEO Dashboard</h1><p>Run `npm run build --workspace goose-aeo-dashboard` to build UI assets.</p>')
    })
  }

  return new Promise<{ close: () => Promise<void> }>((resolve) => {
    const server = app.listen(port, () => {
      resolve({
        close: () =>
          new Promise<void>((done, reject) => {
            server.close((error) => {
              if (error) {
                reject(error)
                return
              }
              done()
            })
          }),
      })
    })
  })
}

const parseArg = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag)
  if (index < 0) {
    return undefined
  }

  return process.argv[index + 1]
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseIntParam(parseArg('--port'), 3847)
  const configPath = parseArg('--config')
  const pricingPath = parseArg('--pricing-config')
  const dataCwd = parseArg('--data-cwd')

  void startDashboardServer({ port, configPath, pricingPath, dataCwd }).then(() => {
    process.stdout.write(`Goose AEO dashboard listening on http://localhost:${port}\n`)
  })
}
