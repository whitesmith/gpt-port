import { zValidator } from '@hono/zod-validator'
import { createHandler } from '../helper/createHandler'
import { validateAPIToken } from '../middleware/validate-token.middleware'
import { MiddlewareHandler } from 'hono'
import { Env } from '../types'
import { proxyAnthropic } from '../middleware/anthropic-proxy.middleware'
import { processRequest, chatCompletionsValidator } from './proxy.route'

const anthropicChatCompletions: MiddlewareHandler<Env> = async c => {
  const { result, provider } = await processRequest(c)
  return proxyAnthropic(c, result, provider, '/v1/chat/completions')
}

const handler = createHandler()

handler
  // ANTHROPIC PROXY FROM AZURE APIs
  .post(
    '/deployments/*/chat/completions',
    zValidator('json', chatCompletionsValidator),
    validateAPIToken,
    anthropicChatCompletions
  )

export default handler
