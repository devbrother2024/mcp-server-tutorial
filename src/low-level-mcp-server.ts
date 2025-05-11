import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
    CallToolRequestSchema,
    GetPromptRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListResourceTemplatesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
    Tool
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

// 도구 입력 스키마 정의
const EchoSchema = z.object({
    message: z.string().describe('Echo할 메시지')
})
const RandomDuckSchema = z.object({
    type: z.enum(['jpg', 'gif'])
})
const ReviewCodePromptSchema = z.object({
    code: z.string()
})

// 도구 이름 enum
enum ToolName {
    ECHO = 'echo',
    RANDOM_DUCK = 'random-duck'
}
// 프롬프트 이름 enum
enum PromptName {
    REVIEW_CODE = 'review-code'
}

// 서버 인스턴스 생성
const server = new Server(
    {
        name: 'low-level-mcp-server',
        version: '1.0.0'
    },
    {
        capabilities: {
            prompts: {},
            resources: {},
            tools: {},
            completions: {}
            // logging: {}
        }
    }
)

// echo 도구 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: ToolName.ECHO,
                description: '입력 메시지를 그대로 반환',
                inputSchema: zodToJsonSchema(EchoSchema) as Tool['inputSchema']
            },
            {
                name: ToolName.RANDOM_DUCK,
                description: '랜덤 오리 이미지를 반환',
                inputSchema: zodToJsonSchema(
                    RandomDuckSchema
                ) as Tool['inputSchema']
            }
        ]
    }
})
server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params
    if (name === ToolName.ECHO) {
        const validatedArgs = EchoSchema.parse(args)
        return {
            content: [
                {
                    type: 'text',
                    text: validatedArgs.message + ' 화이팅!!!!!!!!!!!!!!!!'
                }
            ]
        }
    }
    if (name === ToolName.RANDOM_DUCK) {
        const validatedArgs = RandomDuckSchema.parse(args)
        const response = await fetch(
            `https://random-d.uk/api/random?type=${validatedArgs.type}`
        )
        const data = await response.json()
        const url = data.url
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
                    mimeType: `image/${validatedArgs.type}`
                }
            ]
        }
    }
    throw new Error(`Unknown tool: ${name}`)
})

// 프롬프트 목록 핸들러
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [
            {
                name: PromptName.REVIEW_CODE,
                description: '코드 리뷰 프롬프트',
                arguments: [
                    {
                        name: 'code',
                        description: '리뷰할 코드',
                        required: true
                    }
                ]
            }
        ]
    }
})
// 프롬프트 메시지 핸들러
server.setRequestHandler(GetPromptRequestSchema, async request => {
    const { name, arguments: args } = request.params
    if (name === PromptName.REVIEW_CODE) {
        return {
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `이 코드에 대해서 리뷰 진행해줘: \n\n${args?.code}`
                    }
                }
            ]
        }
    }
    throw new Error(`Unknown prompt: ${name}`)
})

// 정적 리소스(config) 핸들러
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: 'file:///mock-config.json',
                description: 'mock-config.json 파일',
                name: 'config',
                mimeType: 'application/json'
            }
        ]
    }
})
// 동적 리소스(random-image) 핸들러
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
        resourceTemplates: [
            {
                uriTemplate: 'images://{number}',
                name: 'Random Image',
                description: '동적으로 생성되는 이미지 리소스'
            }
        ]
    }
})
server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const uri = request.params.uri
    if (uri === 'file:///mock-config.json') {
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = path.dirname(__filename)
        const mockConfigPath = path.resolve(__dirname, `../mock-config.json`)
        const mockConfig = fs.readFileSync(mockConfigPath, 'utf-8')
        return {
            contents: [
                {
                    uri: uri,
                    text: mockConfig
                }
            ]
        }
    } else if (uri.startsWith('images://')) {
        const number = uri.split('images://')[1]
        const imageUrl = `https://picsum.photos/id/${number}/info`
        return {
            contents: [
                {
                    uri: uri,
                    text: imageUrl
                }
            ]
        }
    }
    throw new Error(`Unknown resource: ${uri}`)
})

const transport = new StdioServerTransport()
server.connect(transport)
