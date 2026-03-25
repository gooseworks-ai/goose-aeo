import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { AEOClient } from '@goose-aeo/core'

interface MCPServerOptions {
  cwd: string
  configPath?: string
}

const textResult = (payload: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify(payload, null, 2),
    },
  ],
})

const withClient = async <T>(options: MCPServerOptions, fn: (client: AEOClient) => Promise<T>) => {
  const client = await AEOClient.create({ cwd: options.cwd, configPath: options.configPath })
  try {
    return await fn(client)
  } finally {
    client.close()
  }
}

export const startMCPServer = async (options: MCPServerOptions) => {
  const server = new McpServer(
    {
      name: 'goose-aeo',
      version: '0.3.0',
    },
    {
      instructions: 'Goose AEO MCP server for run/report/status/diff/cost/query workflows.',
    },
  )

  server.tool('aeo_status', 'Get current AEO status', async () => {
    const payload = await withClient(options, (client) => client.status())
    return textResult(payload)
  })

  server.tool(
    'aeo_run',
    'Run AEO checks',
    {
      providers: z.array(z.enum(['perplexity', 'openai', 'gemini', 'grok', 'claude', 'deepseek'])).optional(),
      queryLimit: z.number().int().positive().optional(),
      confirm: z.boolean().optional(),
      dryRun: z.boolean().optional(),
    },
    async (input) => {
      const payload = await withClient(options, (client) =>
        client.runs.create({
          providers: input.providers,
          queryLimit: input.queryLimit,
          confirm: input.confirm,
          dryRun: input.dryRun,
        }),
      )
      return textResult(payload)
    },
  )

  server.tool(
    'aeo_get_report',
    'Get run report',
    {
      runId: z.string().optional(),
      compareRunId: z.string().optional(),
    },
    async (input) => {
      const payload = await withClient(options, (client) =>
        client.report({ runId: input.runId, compareRunId: input.compareRunId }),
      )
      return textResult(payload)
    },
  )

  server.tool(
    'aeo_report',
    'Get run report',
    {
      runId: z.string().optional(),
      compareRunId: z.string().optional(),
    },
    async (input) => {
      const payload = await withClient(options, (client) =>
        client.report({ runId: input.runId, compareRunId: input.compareRunId }),
      )
      return textResult(payload)
    },
  )

  server.tool(
    'aeo_get_diff',
    'Get diff between runs',
    {
      run1: z.string(),
      run2: z.string(),
    },
    async (input) => {
      const payload = await withClient(options, (client) => client.diff(input.run1, input.run2))
      return textResult(payload)
    },
  )

  server.tool(
    'aeo_diff',
    'Get diff between runs',
    {
      run1: z.string(),
      run2: z.string(),
    },
    async (input) => {
      const payload = await withClient(options, (client) => client.diff(input.run1, input.run2))
      return textResult(payload)
    },
  )

  server.tool(
    'aeo_get_costs',
    'Get cost history',
    {
      last: z.number().int().positive().optional(),
    },
    async (input) => {
      const payload = await withClient(options, (client) => client.costs(input.last))
      return textResult(payload)
    },
  )

  server.tool(
    'aeo_costs',
    'Get cost history',
    {
      last: z.number().int().positive().optional(),
    },
    async (input) => {
      const payload = await withClient(options, (client) => client.costs(input.last))
      return textResult(payload)
    },
  )

  server.tool('aeo_list_queries', 'List active queries', async () => {
    const payload = await withClient(options, (client) => client.queries.listActive())
    return textResult(payload)
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
