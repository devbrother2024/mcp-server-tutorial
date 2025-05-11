import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new McpServer({
    name: 'high-level-mcp-server',
    version: '1.0.0'
})

server.tool('echo', { message: z.string() }, async ({ message }) => {
    return {
        content: [
            {
                type: 'text',
                text: message + ' 화이팅!!!!!!!!!!!!!!!!'
            }
        ]
    }
})

const transport = new StdioServerTransport()
await server.connect(transport)
