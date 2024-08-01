import { Context } from '../types'

const ANTHROPIC_API_HOST = 'https://api.anthropic.com'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const passThroughHeaders = [
  'cache-control',
  'content-type',
  'content-encoding',
]

export const proxyAnthropic = async (
  ctx: Context,
  body: unknown,
  targetPath: string
): Promise<Response> => {
  const req = ctx.req
  const upstreamUrl = `${ANTHROPIC_API_HOST}${targetPath}`
  const headers = prepareHeaders()
  const transformedBody = transformRequestBody(body)

  const response = await fetch(upstreamUrl, {
    method: req.method,
    headers: headers,
    body: req.method === 'POST' && transformedBody ? JSON.stringify(transformedBody) : undefined,
  })

  const originalHeaders = response.headers
  const newHeaders = new Headers(originalHeaders)
  for (const key of originalHeaders.keys()) {
    if (!passThroughHeaders.includes(key)) {
      newHeaders.delete(key)
    }
  }

  // useful in vercel deployment
  const contentType = originalHeaders.get('content-type')
  if (contentType?.includes('event-stream')) {
    newHeaders.set('content-encoding', 'none')
  }

  if (transformedBody.stream) {
    return new Response(transformStream(response.body), {
      headers: newHeaders,
      status: response.status,
    })
  }

  return new Response(response.body, {
    headers: newHeaders,
    status: response.status,
  })
}

function prepareHeaders() {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('x-api-key', ANTHROPIC_API_KEY || '')
  headers.set('anthropic-version', '2023-06-01')
  return headers
}

function transformRequestBody(body: any) {
  if (!body || typeof body !== 'object') return body

  const transformedBody: any = { ...body }

  // Rename the model
  if (transformedBody.model) {
    if (transformedBody.model.includes('gpt-4')) {
      transformedBody.model = 'claude-3-5-sonnet-20240620'
    } else if (transformedBody.model.includes('gpt-3')) {
      transformedBody.model = 'claude-3-haiku-20240307'
    }
  }

  // Convert OpenAI format to Anthropic format
  if (transformedBody.messages) {
    let systemMessage = null;
    transformedBody.messages = transformedBody.messages.filter((msg: any) => {
      if (msg.role === 'system') {
        systemMessage = msg.content;
        return false;
      }
      return true;
    });

    // Add system message as a separate parameter if it exists
    if (systemMessage) {
      transformedBody.system = systemMessage;
    }
  }

  // Add max_tokens if not present
  if (!transformedBody.max_tokens) {
    transformedBody.max_tokens = 4096
  }

  console.log('transformedBody', transformedBody)
  return transformedBody
}

function transformStream(readableStream: ReadableStream<Uint8Array> | null): ReadableStream<Uint8Array> {
  if (!readableStream) {
    throw new Error('No readable stream available')
  }

  let buffer = ''
  let messageId = `chatcmpl-${Date.now()}`
  let created = Math.floor(Date.now() / 1000)
  console.log('Starting stream transformation')

  return readableStream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TransformStream({
      transform(chunk, controller) {
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'message_start') {
              const msg = JSON.stringify({
                id: messageId,
                object: 'chat.completion.chunk',
                created: created,
                model: data.message.model,
                choices: [{
                  index: 0,
                  delta: { role: 'assistant', content: '' },
                  logprobs: null,
                  finish_reason: null
                }]
              }) + '\n'
              controller.enqueue(msg)
              console.log('Received:', line)
              console.log('Sending:', msg)
            } else if (data.type === 'content_block_delta') {
              const msg = JSON.stringify({
                id: messageId,
                object: 'chat.completion.chunk',
                created: created,
                model: 'gpt-3.5-turbo',
                choices: [{
                  index: 0,
                  delta: { content: data.delta.text },
                  logprobs: null,
                  finish_reason: null
                }]
              }) + '\n'
              controller.enqueue(msg)
              console.log('Received:', line)
              console.log('Sending:', msg)
            } else if (data.type === 'message_stop') {
              const msg = JSON.stringify({
                id: messageId,
                object: 'chat.completion.chunk',
                created: created,
                model: 'gpt-3.5-turbo',
                choices: [{
                  index: 0,
                  delta: {},
                  logprobs: null,
                  finish_reason: 'stop'
                }]
              }) + '\n'
              controller.enqueue(msg)
              console.log('Received:', line)
              console.log('Sending:', msg)
            }
          }
        }
      }
    }))
    .pipeThrough(new TextEncoderStream())
}