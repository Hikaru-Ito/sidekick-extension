export type AnthropicModelId = 'claude-opus-4-7' | 'claude-sonnet-4-6';

export const ANTHROPIC_MODELS: {
  id: AnthropicModelId;
  label: string;
  context: string;
  blurb: string;
}[] = [
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    context: '1M',
    blurb: '最高品質。複雑なページや長文に。',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    context: '1M',
    blurb: '速度と品質のバランス。日常用途に。',
  },
];

export type SummaryMode = 'overview' | 'keypoints' | 'chat';

export type Length = 'short' | 'standard' | 'detailed';
export type Tone = 'casual' | 'neutral' | 'formal';
export type Lang = 'ja' | 'en';

export interface UserPreferences {
  defaultModel: AnthropicModelId;
  length: Length;
  tone: Tone;
  lang: Lang;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultModel: 'claude-opus-4-7',
  length: 'standard',
  tone: 'neutral',
  lang: 'ja',
};

export interface AISummarySettings {
  anthropicApiKey: string | null;
  prefs: UserPreferences;
}

export const DEFAULT_SETTINGS: AISummarySettings = {
  anthropicApiKey: null,
  prefs: DEFAULT_PREFERENCES,
};

export interface ExtractedPage {
  title: string;
  url: string;
  byline: string;
  siteName: string;
  excerpt: string;
  content: string;
  /** Approximate character length of the extracted main content. */
  length: number;
  /** True when Readability could not parse the page and we fell back to body text. */
  fallback: boolean;
}

export interface KeyPoint {
  emoji: string;
  title: string;
  body: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface HistoryEntry {
  /** url + mode + content hash + model */
  id: string;
  url: string;
  title: string;
  mode: SummaryMode;
  model: AnthropicModelId;
  /** ISO timestamp */
  createdAt: number;
  /** For overview mode: markdown text. For keypoints: JSON string of KeyPoint[]. For chat: JSON of ChatTurn[]. */
  payload: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export const HISTORY_LIMIT = 20;
