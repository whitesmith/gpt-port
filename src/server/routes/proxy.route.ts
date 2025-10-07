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
  const result = await c.req.valid('json')
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
  const result = await c.req.valid('json')
  const sessionType = (result as any).session?.type
  const model = (result as any).session?.model

  if (sessionType === 'transcription') {
    const modelsController = new ModelController(c.env.redis)
    const provider = await modelsController.findProviderByModel('gpt-4o-realtime-preview')
    if (!provider) {
      throw new HTTPException(401, { message: 'Realtime model not available' })
    }
    return proxyOpenAI(c, result, provider, '/v1/realtime/client_secrets')
  }

  if (!model) {
    throw new HTTPException(400, { message: 'Model required in session' })
  }

  const modelsController = new ModelController(c.env.redis)
  const provider = await modelsController.findProviderByModel(model)

  if (!provider) {
    throw new HTTPException(401, { message: 'Model unsupported' })
  }

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
      throw new HTTPException(400, { message: 'Session and SDP required' })
    }

    const session = JSON.parse(sessionData.toString().split(';')[0])
    model = session.model

    const sdpText = sdpData instanceof File || sdpData instanceof Blob
      ? await sdpData.text()
      : sdpData.toString()
    formData.set('sdp', sdpText)
    formData.set('session', sessionData.toString().split(';')[0])
  } else {
    model = c.req.query('model')
    if (!model) {
      throw new HTTPException(400, { message: 'Model required in query' })
    }

    formData.set('sdp', await c.req.text())
    formData.set('session', JSON.stringify({ model, modalities: ['audio', 'text'] }))
  }

  if (!model) {
    throw new HTTPException(400, { message: 'Model required' })
  }

  const modelsController = new ModelController(c.env.redis)
  const provider = await modelsController.findProviderByModel(model)

  if (!provider) {
    throw new HTTPException(401, { message: 'Model unsupported' })
  }

  return proxyOpenAI(c, formData, provider, '/v1/realtime/calls')
}

export const realtimeCallAccept: MiddlewareHandler<Env> = async c => {
  const result = await c.req.valid('json')
  const model = (result as any).session?.model

  if (!model) {
    throw new HTTPException(400, { message: 'Model required in session' })
  }

  const modelsController = new ModelController(c.env.redis)
  const provider = await modelsController.findProviderByModel(model)

  if (!provider) {
    throw new HTTPException(401, { message: 'Model unsupported' })
  }

  const callId = c.req.param('callId')
  return proxyOpenAI(c, result, provider, `/v1/realtime/calls/${callId}/accept`)
}

export const realtimeCallReject: MiddlewareHandler<Env> = async c => {
  const result = await c.req.valid('json')
  const modelsController = new ModelController(c.env.redis)
  const provider = await modelsController.findProviderByModel('gpt-realtime')

  if (!provider) {
    throw new HTTPException(401, { message: 'Realtime model not available' })
  }

  const callId = c.req.param('callId')
  return proxyOpenAI(c, result, provider, `/v1/realtime/calls/${callId}/reject`)
}

export const realtimeCallHangup: MiddlewareHandler<Env> = async c => {
  const modelsController = new ModelController(c.env.redis)
  const provider = await modelsController.findProviderByModel('gpt-realtime')

  if (!provider) {
    throw new HTTPException(401, { message: 'Realtime model not available' })
  }

  const callId = c.req.param('callId')
  return proxyOpenAI(c, {}, provider, `/v1/realtime/calls/${callId}/hangup`)
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

export const realtimeClientSecretsValidator = z.object({
  session: z.object({
    type: z.enum(['realtime', 'transcription']).optional(),
    model: z.string().optional()
  }).passthrough().optional()
}).passthrough()

export const realtimeCallRejectValidator = z.object({
  status_code: z.number().optional()
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
    zValidator('json', realtimeClientSecretsValidator),
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
    zValidator('json', realtimeClientSecretsValidator),
    validateAPIToken,
    realtimeCallAccept
  )
  .post(
    '/v1/realtime/calls/:callId/reject',
    zValidator('json', realtimeCallRejectValidator),
    validateAPIToken,
    realtimeCallReject
  )
  .post(
    '/v1/realtime/calls/:callId/hangup',
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
