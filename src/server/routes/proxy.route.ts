import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { ModelController } from '../controller/model.controller'
import { createHandler } from '../helper/createHandler'
import { proxyOpenAI } from '../middleware/openai-proxy.middleware'
import { validateAPIToken } from '../middleware/validate-token.middleware'
import { MiddlewareHandler, Context } from 'hono'
import { Env } from '../types'

export const processRequest = async (c: Context) => {
  const result = (c.req as any).valid('json')
  let model = null;
  if ('model' in result) {
    // Get model from body
    model = (result as any).model as string;
  }
  // Fallback to model from path
  if (!model) {
    // Path is like "/api/openai/deployments/gpt-4/chat/completions"
    // or "/api/openai/deployments/text-embedding-ada-002/embeddings"
    model = c.req.path.match(/\/deployments\/(.+?)\//)?.[1] as string;
  }
  const modelsController = new ModelController(c.env.redis)
  const provider = await modelsController.findProviderByModel(model)
  if (!provider) {
    throw new HTTPException(401, {
      message: 'Model unsupported',
    })
  }
  return {
    result,
    provider
  }
}

export const processRealtimeRequest = async (
  c: Context,
  extractModel: (payload: any, c: Context) => string | undefined
) => {
  const result = (c.req as any).valid('json')
  const model = extractModel(result, c)

  if (!model) {
    throw new HTTPException(400, {
      message: 'Model missing',
    })
  }

  const modelsController = new ModelController(c.env.redis)
  const provider = await modelsController.findProviderByModel(model)
  if (!provider) {
    throw new HTTPException(401, {
      message: 'Model unsupported',
    })
  }
  return {
    result,
    provider,
  }
}


export const completions: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRequest(c)
  return proxyOpenAI(c, result, provider, '/v1/completions')
}

export const chatCompletions: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRequest(c)
  return proxyOpenAI(c, result, provider, '/v1/chat/completions')
}

export const embeddings: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRequest(c)
  return proxyOpenAI(c, result, provider, '/v1/embeddings')
}

export const responses: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRequest(c)
  return proxyOpenAI(c, result, provider, '/v1/responses')
}

export const realtimeClientSecrets: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRealtimeRequest(
    c,
    payload => (payload as any).session?.model
  )
  return proxyOpenAI(c, result, provider, '/v1/realtime/client_secrets')
}

export const realtimeCalls: MiddlewareHandler<Env> = async c => {
  let model: string
  const formData = new FormData()

  if (c.req.header('content-type')?.includes('multipart/form-data')) {
    const incoming = await c.req.formData()
    const sessionData = incoming.get('session')
    const sdpData = incoming.get('sdp')

    if (!sessionData || !sdpData) {
      throw new HTTPException(400, { message: 'Invalid realtime payload' })
    }

    const rawSession =
      typeof sessionData === 'string'
        ? sessionData
        : await (sessionData as Blob).text()

    const session = JSON.parse(rawSession.split(';')[0])
    model = session.model

    const sdpText =
      typeof sdpData === 'string'
        ? sdpData
        : await (sdpData as Blob).text()
    formData.set('sdp', sdpText)
    formData.set('session', rawSession.split(';')[0])
  } else {
    model = c.req.query('model') as string
    formData.set('sdp', await c.req.text())
    formData.set('session', JSON.stringify({ model, modalities: ['audio', 'text'] }))
  }

  const modelsController = new ModelController(c.env.redis)
  const provider = await modelsController.findProviderByModel(model)

  if (!provider) {
    throw new HTTPException(401, { message: 'Model unsupported' })
  }

  return proxyOpenAI(c, formData, provider, '/v1/realtime/calls')
}

export const realtimeCallAccept: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRealtimeRequest(
    c,
    payload => (payload as any).model
  )
  const callId = (c.req.param() as Record<string, string>).callId
  return proxyOpenAI(c, result, provider, `/v1/realtime/calls/${callId}/accept`)
}

export const realtimeCallReject: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRealtimeRequest(
    c,
    payload => (payload as any).model
  )
  const callId = (c.req.param() as Record<string, string>).callId
  return proxyOpenAI(c, result, provider, `/v1/realtime/calls/${callId}/reject`)
}

export const realtimeCallHangup: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRealtimeRequest(
    c,
    payload => (payload as any).model
  )
  const callId = (c.req.param() as Record<string, string>).callId
  return proxyOpenAI(c, result, provider, `/v1/realtime/calls/${callId}/hangup`)
}

export const models: MiddlewareHandler<Env> = async c => {
  const redis = c.env.redis
  const modelController = new ModelController(redis)

  const models = await modelController.getModels()

  return c.json({
    "object": "list",
    "data": Object.values(models).map(({ model, type }) => ({
      "id": model,
      "object": "model",
      "created": 1686935002,
      "owned_by": type
    }))
  })
}

const handler = createHandler()

export const chatCompletionsValidator = z.object({
  model: z.string().optional(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.union([
      z.string(),
      z.array(z.any()),
    ])
  })).min(1)
}).passthrough()

export const completionsValidator = z.object({
  model: z.string().optional(),
  prompt: z.union([
    z.string(),
    z.array(z.string())
  ])
}).passthrough()

export const embeddingsValidator = z.object({
  model: z.string().optional(),
  input: z.union([
    z.string(),
    z.array(z.string()).min(1)
  ]).transform(val => Array.isArray(val) ? val : [val])
}).passthrough()

export const responsesValidator = z.object({
  model: z.string().optional(),
  input: z.union([
    z.string(),
    z.array(z.any())
  ]).optional()
}).passthrough()

export const realtimeValidator = z.object({
  model: z.string().optional()
}).passthrough()

handler
  // OPENAI APIs
  .post(
    '/v1/chat/completions',
    zValidator('json', chatCompletionsValidator),
    validateAPIToken,
    chatCompletions
  )
  .post(
    '/v1/completions',
    zValidator('json', completionsValidator),
    validateAPIToken,
    completions
  )
  .post(
    '/v1/embeddings',
    zValidator('json', embeddingsValidator),
    validateAPIToken,
    embeddings
  )
  .post(
    '/v1/responses',
    zValidator('json', responsesValidator),
    validateAPIToken,
    responses
  )
  .post(
    '/v1/realtime/client_secrets',
    zValidator('json', realtimeValidator),
    validateAPIToken,
    realtimeClientSecrets
  )
  .post(
    '/v1/realtime/calls',
    validateAPIToken,
    realtimeCalls
  )
  .post(
    '/v1/realtime/calls/:callId/accept',
    zValidator('json', realtimeValidator),
    validateAPIToken,
    realtimeCallAccept
  )
  .post(
    '/v1/realtime/calls/:callId/reject',
    zValidator('json', realtimeValidator),
    validateAPIToken,
    realtimeCallReject
  )
  .post(
    '/v1/realtime/calls/:callId/hangup',
    zValidator('json', realtimeValidator),
    validateAPIToken,
    realtimeCallHangup
  )
  .get(
    '/v1/models',
    validateAPIToken,
    models
  )
  // AZURE APIs
  .post(
    '/deployments/*/chat/completions',
    zValidator('json', chatCompletionsValidator),
    validateAPIToken,
    chatCompletions
  )
  .post(
    '/deployments/*/completions',
    zValidator('json', completionsValidator),
    validateAPIToken,
    completions
  )
  .post(
    '/deployments/*/embeddings',
    zValidator('json', embeddingsValidator),
    validateAPIToken,
    embeddings
  )
  .post(
    '/deployments/*/responses',
    zValidator('json', responsesValidator),
    validateAPIToken,
    responses
  )

export default handler
