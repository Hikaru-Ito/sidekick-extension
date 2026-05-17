import type { ExtractedPage, Lang, Length, SummaryMode, Tone } from '../types';

function lengthLabel(length: Length, lang: Lang): string {
  if (lang === 'en') {
    return length === 'short'
      ? 'in 3–4 short sentences'
      : length === 'detailed'
        ? 'in 6–10 well-structured paragraphs'
        : 'in 2–4 paragraphs';
  }
  return length === 'short'
    ? '3〜4文の簡潔な要約'
    : length === 'detailed'
      ? '6〜10段落の詳しい解説'
      : '2〜4段落の標準的な要約';
}

function toneLabel(tone: Tone, lang: Lang): string {
  if (lang === 'en') {
    return tone === 'casual' ? 'casual' : tone === 'formal' ? 'formal' : 'neutral';
  }
  return tone === 'casual' ? '話し言葉のカジュアルな' : tone === 'formal' ? '硬めの' : '中立的な';
}

const ENGLISH_SYSTEM = `You are an expert reading assistant. The user is browsing a webpage and wants help understanding it.

Hard rules:
- Stay grounded in the supplied page content. Do not invent facts not present in the text.
- If the page is in a different language than the user's preferred output language, translate.
- If the page appears empty, paywalled, or you cannot find substantive content, say so plainly.
- Markdown is supported: use headings, bullet lists, and inline code where it helps.
- Do not include preambles like "Sure, here is the summary"; produce the summary directly.`;

const JAPANESE_SYSTEM = `あなたは熟練した読書アシスタントです。ユーザーが今ブラウザで開いているページの内容を、分かりやすく案内します。

厳守ルール:
- 与えられたページ本文に忠実に答え、本文に無い事実を作らない。
- ページが別言語の場合はユーザーの希望言語に翻訳する。
- ページが空・有料壁の向こう・実質的内容が取れない場合はその旨を素直に伝える。
- マークダウンを使ってよい (見出し・箇条書き・コード)。
- 「了解しました」「以下が要約です」等の前置きは書かず、本文から始める。`;

export function systemPrompt(lang: Lang): string {
  return lang === 'en' ? ENGLISH_SYSTEM : JAPANESE_SYSTEM;
}

/** Build the cacheable "page envelope" — kept identical across calls so the
 * Anthropic prompt cache hits between mode switches. */
export function pageEnvelope(page: ExtractedPage): string {
  const meta = [
    `Title: ${page.title}`,
    `URL: ${page.url}`,
    page.siteName ? `Site: ${page.siteName}` : '',
    page.byline ? `Byline: ${page.byline}` : '',
    page.fallback
      ? 'Extraction note: Readability fallback was used; the text may include navigation chrome.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `<page>\n${meta}\n\n<content>\n${page.content}\n</content>\n</page>`;
}

export interface InstructionInput {
  mode: SummaryMode;
  lang: Lang;
  length: Length;
  tone: Tone;
}

/** The variable, mode-specific instruction that goes AFTER the cached page. */
export function modeInstruction({ mode, lang, length, tone }: InstructionInput): string {
  const lenStr = lengthLabel(length, lang);
  const toneStr = toneLabel(tone, lang);
  const langName = lang === 'en' ? 'English' : '日本語';

  if (mode === 'overview') {
    return lang === 'en'
      ? `Write a ${toneStr} summary of the page above ${lenStr}, in ${langName}.
Lead with a 1-sentence TL;DR, then expand. Use markdown headings only if it improves clarity.`
      : `上のページを ${toneStr}トーンで ${lenStr} にまとめてください。出力は ${langName}。
1文の要約を冒頭に置き、続けて本文を展開してください。マークダウンの見出しは必要に応じて使用可。`;
  }

  if (mode === 'keypoints') {
    return lang === 'en'
      ? `Return EXACTLY a JSON array with 3 to 5 items describing the page's most important points, in ${langName}.
Each item: { "emoji": string (single emoji), "title": string (≤ 8 words), "body": string (1–2 sentences) }
Output ONLY the JSON array — no markdown fences, no preface.`
      : `ページの最重要ポイントを 3〜5 項目、JSON 配列で正確に返してください。出力言語は ${langName}。
各要素: { "emoji": 絵文字1個, "title": 12字以内, "body": 1〜2文の説明 }
JSON配列のみを返す(マークダウンの ` +
          '```' +
          ` で囲まない・前後に文章を付けない)。`;
  }

  // chat mode is handled by the caller building a multi-turn messages array.
  return '';
}

/** Initial assistant priming for chat mode. */
export function chatGreeting(lang: Lang): string {
  return lang === 'en'
    ? 'I have read the page. Ask me anything about it.'
    : 'ページの内容を読みました。気になることを聞いてください。';
}
