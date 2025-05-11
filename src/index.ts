import {
    McpServer,
    ResourceTemplate
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const server = new McpServer({
    name: 'high-level-mcp-server',
    version: '1.0.0'
})

// 도구
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

server.tool(
    'random-duck',
    {
        type: z.enum(['jpg', 'gif'])
    },
    async ({ type }) => {
        const response = await fetch(
            `https://random-d.uk/api/random?type=${type}`
        )
        const data = await response.json()
        const url = data.url
        console.error(url)

        // 이미지 확장자 체크
        if (!url.match(/\.(jpg|gif)$/i)) {
            throw new Error('API에서 이미지 URL이 반환되지 않았습니다.')
        }

        const base64EncodedImage = await fetch(url).then(res =>
            res.arrayBuffer()
        )
        const base64Image = Buffer.from(base64EncodedImage).toString('base64')

        return {
            content: [
                {
                    type: 'image',
                    data: base64Image,
                    mimeType: `image/${type}`
                }
            ]
        }
    }
)

// 프롬프트
server.prompt('review-code', { code: z.string() }, ({ code }) => {
    return {
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `이 코드에 대해서 리뷰 진행해줘: \n\n${code}`
                }
            }
        ]
    }
})

// 정적 리소스
server.resource('config', 'file:///mock-config.json', uri => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    const mockConfigPath = path.resolve(__dirname, `../mock-config.json`)
    const mockConfig = fs.readFileSync(mockConfigPath, 'utf-8')

    return {
        contents: [
            {
                uri: uri.href,
                text: mockConfig
            }
        ]
    }
})

// 동적 리소스
server.resource(
    'random-image',
    new ResourceTemplate('images://{number}', { list: undefined }),
    (uri, { number }) => {
        const imageUrl = `https://picsum.photos/id/${number}/info`

        return {
            contents: [{ uri: uri.href, text: imageUrl }]
        }
    }
)

const transport = new StdioServerTransport()
await server.connect(transport)
