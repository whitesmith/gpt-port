import ModelsRoute from './models.route'
import TokensRoute from './tokens.route'
import OpenAIProxyRoute from './proxy.route'
import AnthropicProxyRoute from './anthropic-proxy.route'

const routes = [
  {
    path: '/models',
    handler: ModelsRoute,
  },
  {
    path: '/tokens',
    handler: TokensRoute,
  },
  {
    path: '/openai',
    handler: OpenAIProxyRoute,
  },
  {
    path: '/anthropic/openai',
    handler: AnthropicProxyRoute,
  },
]

export { routes }
