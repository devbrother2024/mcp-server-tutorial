import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
    CallToolRequestSchema,
    CreateMessageRequest,
    CreateMessageResultSchema,
    GetPromptRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListResourceTemplatesRequestSchema,
    ListRootsRequest,
    ListRootsResultSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
    RootsListChangedNotificationSchema,
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
    type: z.enum(['jpg', 'gif']).describe('이미지 타입')
})
const ReviewCodePromptSchema = z.object({
    code: z.string().describe('리뷰할 코드')
})
const SamplingSchema = z.object({
    prompt: z.string().describe('샘플링할 프롬프트')
})
const ListRootDirSchema = z.object({})

// 도구 이름 enum
enum ToolName {
    ECHO = 'echo',
    RANDOM_DUCK = 'random-duck',
    SAMPLING = 'sampling',
    LIST_ROOT_DIR = 'list-root-dir'
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
            tools: {}
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
            },
            {
                name: ToolName.SAMPLING,
                description: '샘플링 도구',
                inputSchema: zodToJsonSchema(
                    SamplingSchema
                ) as Tool['inputSchema']
            },
            {
                name: ToolName.LIST_ROOT_DIR,
                description: '루트 디렉토리 목록 조회',
                inputSchema: zodToJsonSchema(
                    ListRootDirSchema
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
    if (name === ToolName.SAMPLING) {
        const validatedArgs = SamplingSchema.parse(args)

        const request: CreateMessageRequest = {
            method: 'sampling/createMessage',
            params: {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: validatedArgs.prompt
                        }
                    }
                ],
                systemPrompt: 'You are a helpful assistant.',
                maxTokens: 100,
                temperature: 0.7,
                includeContext: 'thisServer'
            }
        }

        const result = await server.request(request, CreateMessageResultSchema)

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result)
                }
            ]
        }
    }
    if (name === ToolName.LIST_ROOT_DIR) {
        const request: ListRootsRequest = {
            method: 'roots/list',
            params: {}
        }

        const response = await server.request(request, ListRootsResultSchema)
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response)
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
        ReviewCodePromptSchema.parse(args)
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

// roots/list_changed 알림 핸들러 등록
server.setNotificationHandler(
    RootsListChangedNotificationSchema,
    async params => {
        // roots 변경 알림을 받으면 콘솔에 출력
        console.error('[알림] 클라이언트에서 roots가 변경되었습니다:', params)
        // 필요시 추가 동작 구현 가능
    }
)

const transport = new StdioServerTransport()
server.connect(transport)
