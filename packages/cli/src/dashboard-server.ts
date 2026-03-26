import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { AEOClient } from '@goose-aeo/core'

interface ServerOptions {
  port?: number
  configPath?: string
  pricingPath?: string
  dataCwd?: string
  staticRoot?: string
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

const checkPort = (port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const tester = net
      .createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use. Kill the existing process or use --port <number>.`))
        } else if (err.code === 'EACCES') {
          reject(new Error(`Permission denied for port ${port}. Use a port number above 1024 or run with elevated privileges.`))
        } else {
          reject(err)
        }
      })
      .once('listening', () => {
        tester.close()
        resolve()
      })
      .listen(port)
  })

export async function startDashboardServer(options: ServerOptions = {}) {
  const port = options.port ?? 3847

  await checkPort(port)

  const app = express()

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
        res.status(404).json({ error: 'No recommendations found for this run' })
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

  const staticDir = options.staticRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'public')
  if (existsSync(staticDir)) {
    app.use(express.static(staticDir))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'))
    })
  } else {
    app.get('*', (_req, res) => {
      res.type('html').send('<h1>Goose AEO Dashboard</h1><p>Dashboard UI assets not found. API endpoints are available at /api/*.</p>')
    })
  }

  return new Promise<{ close: () => Promise<void> }>((resolve, reject) => {
    const server = app.listen(port)
    server.once('error', reject)
    server.once('listening', () => {
      server.removeListener('error', reject)
      resolve({
        close: () =>
          new Promise<void>((done, rej) => {
            server.close((error) => {
              if (error) {
                rej(error)
                return
              }
              done()
            })
          }),
      })
    })
  })
}
