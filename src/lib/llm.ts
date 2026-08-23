/**
 * Provider-agnostic LLM access.
 *
 * The reviewer only needs a single primitive: send a system + user prompt and
 * get back text (which we ask the model to make JSON). This keeps "bring your
 * own LLM" simple — point it at any of:
 *
 *  - `openai`            OpenAI proper.
 *  - `openai-compatible` Any OpenAI-compatible endpoint via OPENAI_BASE_URL
 *                        (vLLM, OpenRouter, Together, Groq, LM Studio, self-host).
 *  - `anthropic`         Native Anthropic / Claude Messages API.
 *  - `ollama`            Local Ollama server.
 */
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface LLMRequest {
  system: string;
  user: string;
  /** Hint that we want strict JSON back (best-effort per provider). */
  json?: boolean;
}

export type AIProvider = 'openai' | 'openai-compatible' | 'anthropic' | 'ollama';

export function getProvider(): AIProvider {
  const raw = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  if (raw === 'openai' || raw === 'openai-compatible' || raw === 'anthropic' || raw === 'ollama') {
    return raw;
  }
  console.warn(`⚠️  Unknown AI_PROVIDER "${raw}", falling back to "openai".`);
  return 'openai';
}

const MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '4000', 10);
const TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE || '0.2');

export async function callLLM(req: LLMRequest): Promise<string> {
  switch (getProvider()) {
    case 'anthropic':
      return callAnthropic(req);
    case 'ollama':
      return callOllama(req);
    case 'openai':
    case 'openai-compatible':
    default:
      return callOpenAICompatible(req);
  }
}

async function callOpenAICompatible(req: LLMRequest): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'not-needed',
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL || 'gpt-5.4';

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
    // temperature: TEMPERATURE,
    // max_completion_tokens: MAX_TOKENS,
    // Many OpenAI-compatible servers accept this; the ones that don't ignore it.
    ...(req.json ? { response_format: { type: 'json_object' as const } } : {}),
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('Empty response from OpenAI-compatible provider');
  return text;
}

async function callAnthropic(req: LLMRequest): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

  const message = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    // temperature: TEMPERATURE,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  if (!text) throw new Error('Empty response from Anthropic');
  return text;
}

async function callOllama(req: LLMRequest): Promise<string> {
  const base = process.env.OLLAMA_URL || 'http://localhost:11434';
  // Accept either a bare host or a full /api/* URL for backwards compatibility.
  const url = base.includes('/api/') ? base.replace(/\/api\/.*/, '/api/chat') : `${base.replace(/\/$/, '')}/api/chat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || 'codellama',
      stream: false,
      options: { temperature: TEMPERATURE },
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const text = data.message?.content;
  if (!text) throw new Error('Empty response from Ollama');
  return text;
}

/**
 * Resilient JSON extraction from an LLM response. Handles reasoning-model
 * `<think>` blocks, markdown code fences, and prose wrapped around the JSON.
 * Returns `null` if nothing parseable is found.
 */
export function extractJSON<T = any>(response: string): T | null {
  let cleaned = response.trim();
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the largest brace-delimited span.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Human-readable label of the active model, for stored review metadata. */
export function activeModelLabel(): string {
  switch (getProvider()) {
    case 'anthropic':
      return process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
    case 'ollama':
      return process.env.OLLAMA_MODEL || 'codellama';
    default:
      return process.env.OPENAI_MODEL || 'gpt-4o';
  }
}
