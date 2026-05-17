import Anthropic from '@anthropic-ai/sdk';
import { chatGreeting, modeInstruction, pageEnvelope, systemPrompt } from './prompts';
import type {
  AnthropicModelId,
  ChatTurn,
  ExtractedPage,
  KeyPoint,
  Lang,
  Length,
  Tone,
} from '../types';

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export function createClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

// Adaptive thinking is supported only on the 4.6/4.7 model family. Older
// models (Haiku 4.5, Sonnet 4.5, …) reject the parameter with a 400. We
// gate it here so a stale model id surviving in storage doesn't crash the
// whole request.
const ADAPTIVE_THINKING_MODELS = new Set<AnthropicModelId>([
  'claude-opus-4-7',
  'claude-sonnet-4-6',
]);

function thinkingParam(model: AnthropicModelId): { thinking: { type: 'adaptive' } } | object {
  return ADAPTIVE_THINKING_MODELS.has(model) ? { thinking: { type: 'adaptive' as const } } : {};
}

/** Test the API key with a tiny request. Returns null on success, error message on failure. */
export async function pingApiKey(apiKey: string): Promise<string | null> {
  try {
    const client = createClient(apiKey);
    await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'ping' }],
    });
    return null;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return 'APIキーが無効です';
    if (err instanceof Anthropic.RateLimitError) return 'レートリミットに達しています';
    if (err instanceof Anthropic.APIError) return `API エラー: ${err.status}`;
    return err instanceof Error ? err.message : '不明なエラー';
  }
}

interface OverviewParams {
  apiKey: string;
  model: AnthropicModelId;
  page: ExtractedPage;
  length: Length;
  tone: Tone;
  lang: Lang;
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}

/** Streams a markdown summary; resolves with the full text + usage info. */
export async function streamOverview(
  params: OverviewParams,
): Promise<{ text: string; usage: UsageInfo }> {
  const client = createClient(params.apiKey);
  const instruction = modeInstruction({
    mode: 'overview',
    lang: params.lang,
    length: params.length,
    tone: params.tone,
  });

  const stream = client.messages.stream(
    {
      model: params.model,
      max_tokens: 4096,
      ...thinkingParam(params.model),
      system: systemPrompt(params.lang),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: pageEnvelope(params.page),
              cache_control: { type: 'ephemeral' },
            },
            { type: 'text', text: instruction },
          ],
        },
      ],
    },
    { signal: params.signal },
  );

  let buffer = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      buffer += event.delta.text;
      params.onDelta(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  return { text: buffer, usage: extractUsage(final.usage) };
}

interface KeyPointsParams {
  apiKey: string;
  model: AnthropicModelId;
  page: ExtractedPage;
  length: Length;
  tone: Tone;
  lang: Lang;
  signal?: AbortSignal;
}

export async function generateKeyPoints(
  params: KeyPointsParams,
): Promise<{ points: KeyPoint[]; usage: UsageInfo; raw: string }> {
  const client = createClient(params.apiKey);
  const instruction = modeInstruction({
    mode: 'keypoints',
    lang: params.lang,
    length: params.length,
    tone: params.tone,
  });

  const response = await client.messages.create(
    {
      model: params.model,
      max_tokens: 1024,
      ...thinkingParam(params.model),
      system: systemPrompt(params.lang),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: pageEnvelope(params.page),
              cache_control: { type: 'ephemeral' },
            },
            { type: 'text', text: instruction },
          ],
        },
      ],
    },
    { signal: params.signal },
  );

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const points = parseKeyPoints(text);
  return { points, raw: text, usage: extractUsage(response.usage) };
}

function parseKeyPoints(text: string): KeyPoint[] {
  // Strip optional code fences ```json ... ``` just in case the model adds them.
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch?.[1]) cleaned = fenceMatch[1].trim();

  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map((p) => ({
        emoji: typeof p.emoji === 'string' ? p.emoji : '•',
        title: typeof p.title === 'string' ? p.title : '',
        body: typeof p.body === 'string' ? p.body : '',
      }))
      .filter((p) => p.title || p.body);
  } catch {
    return [];
  }
}

interface ChatParams {
  apiKey: string;
  model: AnthropicModelId;
  page: ExtractedPage;
  history: ChatTurn[];
  newUserMessage: string;
  lang: Lang;
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(params: ChatParams): Promise<{ text: string; usage: UsageInfo }> {
  const client = createClient(params.apiKey);
  const messages: Anthropic.MessageParam[] = [];

  // First turn carries the page envelope with a cache breakpoint.
  // Subsequent turns are appended verbatim.
  messages.push({
    role: 'user',
    content: [
      {
        type: 'text',
        text: pageEnvelope(params.page),
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text:
          params.lang === 'en'
            ? 'I have a few questions about the page above.'
            : '上のページについていくつか質問があります。',
      },
    ],
  });
  messages.push({ role: 'assistant', content: chatGreeting(params.lang) });

  for (const turn of params.history) {
    messages.push({ role: turn.role, content: turn.text });
  }
  messages.push({ role: 'user', content: params.newUserMessage });

  const stream = client.messages.stream(
    {
      model: params.model,
      max_tokens: 4096,
      ...thinkingParam(params.model),
      system: systemPrompt(params.lang),
      messages,
    },
    { signal: params.signal },
  );

  let buffer = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      buffer += event.delta.text;
      params.onDelta(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  return { text: buffer, usage: extractUsage(final.usage) };
}

function extractUsage(u: Anthropic.Usage): UsageInfo {
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
  };
}
