import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '@/lib/utils/env.server';
import { logger, safeErrorMeta } from '@/lib/logging/logger';

let anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const env = getEnv();
    anthropicClient = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export interface LLMCallParams {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export async function callClaude(params: LLMCallParams): Promise<string> {
  const { prompt, maxTokens = 2000, temperature = 0.3 } = params;

  try {
    const client = getAnthropicClient();

    logger.debug('Calling Claude API', {
      promptLength: prompt.length,
      maxTokens,
      temperature,
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    logger.info('Claude API call successful', {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    return content.text;
  } catch (error) {
    logger.error('Claude API call failed', { stage: 'llm_call', ...safeErrorMeta(error) });
    throw new Error('LLM call failed');
  }
}
