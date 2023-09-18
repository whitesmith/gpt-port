import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { ModelController } from '../controller/model.controller'
import { createHandler } from '../helper/createHandler'
import { proxyCompletions } from '../middleware/openai-proxy.middleware'
import { validateAPIToken } from '../middleware/validate-token.middleware'
import { MiddlewareHandler } from 'hono'
import { Env } from '../types'

const cb: MiddlewareHandler<Env> = async c => {
  console.log(c.req.path)
  const result = await c.req.valid('json')
  let model = null;
  if ('model' in result) {
    // Get model from body
    model = (result as any).model as string;
  }
  // Fallback to model from path
  if (!model) {
    // Path is like "/api/openai/deployments/gpt-4/chat/completions"
    model = c.req.path.match(/\/deployments\/(.+?)\//)?.[1] as string;
  }
  const modelsController = new ModelController(c.env.redis)
  const provider = await modelsController.findProviderByModel(model)
  if (!provider) {
    throw new HTTPException(401, {
      message: 'Model unsupported',
    })
  }
  return proxyCompletions(c, result, provider, '/v1/chat/completions')
}

const handler = createHandler()

handler
  .post(
    '/v1/chat/completions',
    zValidator('json', z.object({ model: z.string().min(1) }).passthrough()),
    validateAPIToken,
    cb
  )
  .post(
    '/deployments/*/chat/completions',
    zValidator('json', z.object({
      messages: z.array(z.object({
        role: z.string(),
        content: z.string()
      })).min(1)
    }).passthrough()),
    validateAPIToken,
    cb
  )

export default handler
