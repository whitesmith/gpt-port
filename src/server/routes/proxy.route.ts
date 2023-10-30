import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { ModelController } from '../controller/model.controller'
import { createHandler } from '../helper/createHandler'
import { proxyOpenAI } from '../middleware/openai-proxy.middleware'
import { validateAPIToken } from '../middleware/validate-token.middleware'
import { MiddlewareHandler, Context } from 'hono'
import { Env } from '../types'

const processRequest = async (c:Context) => {
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

const completions: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRequest(c)
  return proxyOpenAI(c, result, provider, '/v1/completions')
}

const chatCompletions: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRequest(c)
  return proxyOpenAI(c, result, provider, '/v1/chat/completions')
}

const embeddings: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRequest(c)
  return proxyOpenAI(c, result, provider, '/v1/embeddings')
}

const models: MiddlewareHandler<Env> = async c => {
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

handler
  // OPENAI APIs
  .post(
    '/v1/chat/completions',
    zValidator('json', z.object({
      model: z.string().min(1),
      messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
      })).min(1)
    }).passthrough()),
    validateAPIToken,
    chatCompletions
  )
  .post(
    '/v1/completions',
    zValidator('json', z.object({
      model: z.string().min(1),
      prompt: z.union([
        z.string().min(1),
        z.array(z.string().min(1))
      ])
    }).passthrough()),
    validateAPIToken,
    completions
  )
  .post(
    '/v1/embeddings',
    zValidator('json', z.object({
      model: z.string().min(1),
      input: z.union([
        z.string().min(1),
        z.array(z.string().min(1))
      ])
    }).passthrough()),
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
    zValidator('json', z.object({
      messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
      })).min(1)
    }).passthrough()),
    validateAPIToken,
    chatCompletions
  )
  .post(
    '/deployments/*/completions',
    zValidator('json', z.object({
      model: z.string().min(1),
      prompt: z.union([
        z.string().min(1),
        z.array(z.string().min(1))
      ])
    }).passthrough()),
    validateAPIToken,
    completions
  )
  .post(
    '/deployments/*/embeddings',
    zValidator('json', z.object({
      input: z.union([
        z.string().min(1),
        z.array(z.string().min(1))
      ])
    }).passthrough()),
    validateAPIToken,
    embeddings
  )
  


export default handler
