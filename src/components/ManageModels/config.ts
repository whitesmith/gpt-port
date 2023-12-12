import { z } from 'zod'
import { FormField } from '../Form/type'

export const OpenAIModelProviderFields: FormField[] = [
  {
    required: true,
    key: 'model',
    schema: z.enum(['gpt-3.5-turbo', 'gpt-4', 'text-embedding-ada-002']),
    label: 'Model',
    defaultValue: 'gpt-3.5-turbo',
  },
  {
    required: true,
    key: 'apiKey',
    schema: z.string().min(1),
    label: 'API Key',
    defaultValue: '',
  },
  {
    required: false,
    key: 'endpoint',
    schema: z.string().url(),
    label: 'Endpoint',
    defaultValue: 'https://api.openai.com',
  },
]

export const AzureAIModelProviderFields: FormField[] = [
  {
    required: true,
    key: 'model',
    schema: z.enum(['gpt-3.5-turbo', 'gpt-35-turbo-16k', 'gpt-35-turbo-1106', 'gpt-4', 'gpt-4-turbo', 'gpt-4-vision', 'gpt-4-32k', 'text-embedding-ada-002']),
    label: 'Model',
    defaultValue: 'gpt-4-turbo',
  },
  {
    required: true,
    key: 'apiKey',
    schema: z.string().min(1),
    label: 'API Key',
    defaultValue: '',
  },
  {
    required: true,
    key: 'apiVersion',
    schema: z.string().min(1),
    label: 'API Version',
    defaultValue: '2023-05-15',
  },
  {
    required: true,
    key: 'deployment',
    schema: z.string().min(1),
    label: 'Deployment',
    defaultValue: 'gpt-35-turbo',
  },
  {
    required: true,
    key: 'instance',
    schema: z.string().min(1),
    label: 'Instance name',
    defaultValue: '',
  },
]
