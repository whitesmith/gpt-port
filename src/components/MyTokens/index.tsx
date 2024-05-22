import { useDeleteToken, useMyTokens } from '@/hooks/useTokens'
import TokensTable from './TokensTable'
import CreateToken from './CreateToken'
import { openConfirmModal } from '@mantine/modals'
import {
  ActionIcon,
  Box,
  Code,
  Container,
  CopyButton,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { HiOutlineCheck, HiOutlineClipboardDocument } from 'react-icons/hi2'
import { useAPIHost } from './useAPIHost'

export default function MyTokens() {
  const { data } = useMyTokens()
  const deleteTokenMutation = useDeleteToken()
  const apiHost = useAPIHost()

  const handleRevokeKey = (tokenId: string) => {
    openConfirmModal({
      title: 'Revoke Key',
      children:
        "This API key will immediately be disabled. API requests made using this key will be rejected, which could cause any systems still depending on it to break. Once revoked, you'll no longer be able to view or modify this API key.",
      centered: true,
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteTokenMutation.trigger(tokenId)
      },
    })
  }

  return (
    <Container size={'sm'} py='xl' sx={{ flex: 1 }}>
      <Paper p='md' withBorder>
        <Stack>
          <Text color='dimmed'>
            {
              'To use the API Key with the official OpenAI library set the custom API host to the following url and use the key as instructed in the docs.'
            }
          </Text>

          <Group mb="md">
            <Text fw='bold'>{'OpenAI API Host'}</Text>
            <Code>{`${apiHost}/api/openai`}</Code>
            <CopyButton value={`${apiHost}/api/openai`}>
              {({ copied, copy }) => (
                <Tooltip
                  label={copied ? 'Copied' : 'Copy'}
                  withArrow
                  position='right'
                >
                  <ActionIcon
                    color={copied ? 'blue' : 'gray'}
                    onClick={copy}
                    variant='light'
                  >
                    {copied ? (
                      <HiOutlineCheck size='1rem' />
                    ) : (
                      <HiOutlineClipboardDocument size='1rem' />
                    )}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>

          <Text color='dimmed'>
            {
              'To use the key in place of an Azure OpenAI endpoint use these following credentials:'
            }
          </Text>

          <Group>
            <Text fw='bold'>{'Azure Base URL'}</Text>
            <Code>{`${apiHost}/api`}</Code>
            <CopyButton value={`${apiHost}/api`}>
              {({ copied, copy }) => (
                <Tooltip
                  label={copied ? 'Copied' : 'Copy'}
                  withArrow
                  position='right'
                >
                  <ActionIcon
                    color={copied ? 'blue' : 'gray'}
                    onClick={copy}
                    variant='light'
                  >
                    {copied ? (
                      <HiOutlineCheck size='1rem' />
                    ) : (
                      <HiOutlineClipboardDocument size='1rem' />
                    )}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
            <Text fw='bold'>{'or'}</Text>
            <CopyButton value={`${apiHost}/api/openai/deployments`}>
              {({ copied, copy }) => (
                <Tooltip
                  label={copied ? 'Copied' : 'Copy'}
                  withArrow
                  position='right'
                >
                  <ActionIcon
                    color={copied ? 'blue' : 'gray'}
                    onClick={copy}
                    variant='light'
                  >
                    {copied ? (
                      <HiOutlineCheck size='1rem' />
                    ) : (
                      <HiOutlineClipboardDocument size='1rem' />
                    )}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Group mb="md">
            <Text fw='bold'>{'Azure Deployment Name'}</Text>
            {['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo-1106', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4-32k', 'gpt-35-turbo-16k', 'gpt-4-vision', 'text-embedding-ada-002'].map((deploymentName) => (
              <Code key={deploymentName}>{deploymentName}</Code>
            ))}
          </Group>

          <Text fw='bold'>{'API Keys'}</Text>
          <TokensTable tokens={data || {}} onDelete={handleRevokeKey} />

          <Box>
            <CreateToken />
          </Box>
        </Stack>
      </Paper>
    </Container>
  )
}
