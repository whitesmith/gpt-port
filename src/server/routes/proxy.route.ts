import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { ModelController } from '../controller/model.controller'
import { createHandler } from '../helper/createHandler'
import { proxyOpenAI } from '../middleware/openai-proxy.middleware'
import { validateAPIToken } from '../middleware/validate-token.middleware'
import { MiddlewareHandler, Context } from 'hono'
import { Env } from '../types'

export const processRequest = async (c:Context) => {
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
    z.array(z.string())
  ])
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

export default handler
