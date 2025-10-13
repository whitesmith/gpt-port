import { Context } from '../types'

const OPENAI_API_HOST = 'https://api.openai.com'

const passThroughHeaders = [
  'cache-control',
  'openai-model',
  'content-type',
  'openai-version',
  'content-encoding',
]

export const proxyOpenAI = async (
  ctx: Context,
  body: unknown,
  provider: ModelProvider,
  targetPath: string
): Promise<Response> => {
  const req = ctx.req
  const upstreamUrl = getUpstreamURL(provider, targetPath)
  const headers = prepareHeaders(provider)

  let requestBody: BodyInit | undefined

  if (body instanceof FormData) {
    headers.delete('Content-Type')
    requestBody = body
  } else {
    let modifiedBody = body as Record<string, any>
    if (modifiedBody?.model === 'gpt-5-high') {
      modifiedBody.model = 'gpt-5'
      if (targetPath !== '/v1/responses') {
        modifiedBody.reasoning_effort = 'high'
      }
    }
    requestBody = req.method === 'POST' && modifiedBody ? JSON.stringify(modifiedBody) : undefined
  }

  const response = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body: requestBody,
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

  return new Response(response.body, {
    headers: newHeaders,
    status: response.status,
  })
}

function prepareHeaders(provider: ModelProvider) {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('X-Title', 'WS-GPTPort')

  if (provider.type === 'openai') {
    headers.set('Authorization', `Bearer ${provider.apiKey}`)
  }

  if (provider.type === 'azure') {
    headers.set('api-key', provider.apiKey)
  }

  return headers
}

function getUpstreamURL(provider: ModelProvider, targetPath: string) {
  if (provider.type === 'openai') {
    return provider.endpoint
      ? `${provider.endpoint.replace(/\/$/, '')}${targetPath}`
      : `${OPENAI_API_HOST}${targetPath}`
  }

  if (provider.type === 'azure') {
    const path = targetPath.replace(/^\/v1/, '')
    return `https://${provider.instance}.openai.azure.com/openai/deployments/${provider.deployment}/${path}?api-version=${provider.apiVersion}`
  }

  throw new Error('Invalid model provider')
}
