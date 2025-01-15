import { z } from 'zod'
import { FormField } from '../Form/type'

export const OpenAIModelProviderFields: FormField[] = [
  {
    required: true,
    key: 'model',
    schema: z.enum([
      'gpt-4o',
      'gpt-4o-2024-11-20',
      'gpt-4o-2024-08-06',
      'gpt-4o-2024-05-13',
      'gpt-4o-mini',
      'gpt-4o-mini-2024-07-18',
      'gpt-4o-realtime-preview',
      'gpt-4o-realtime-preview-2024-10-01',
      'gpt-4o-audio-preview',
      'gpt-4o-audio-preview-2024-10-01',
      'o1',
      'o1-2024-12-17',
      'o1-preview',
      'o1-preview-2024-09-12',
      'o1-mini',
      'o1-mini-2024-09-12',
      'gpt-4-turbo',
      'gpt-4-turbo-2024-04-09',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
      'dall-e-3',
      'dall-e-2',
      'tts-1',
      'tts-1-hd',
      'whisper-1',
      'text-embedding-3-large',
      'text-embedding-3-small',
      'text-embedding-ada-002'
    ]),
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
    schema: z.enum([
      'gpt-3.5-turbo',
      'gpt-35-turbo-1106',
      'gpt-35-turbo-16k',
      'gpt-4-32k',
      'gpt-4-turbo-preview',
      'gpt-4-turbo',
      'gpt-4-vision-preview',
      'gpt-4-vision',
      'gpt-4o',
      'gpt-4',
      'gpt-4o-mini',
      'text-embedding-ada-002',
      'text-embedding-3-large'
    ]),
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
