import type { ExtractedPage, Lang, Length, SummaryMode, Tone } from '../types';

function lengthLabel(length: Length, lang: Lang): string {
  if (lang === 'en') {
    return length === 'short'
      ? '3–4 short sentences'
      : length === 'detailed'
        ? '6–10 short paragraphs'
        : '2–4 short paragraphs';
  }
  return length === 'short'
    ? '3〜4文の短いまとめ'
    : length === 'detailed'
      ? '6〜10段落のじっくり解説'
      : '2〜4段落のちょうどよい長さ';
}

function toneLabel(tone: Tone, lang: Lang): string {
  if (lang === 'en') {
    return tone === 'casual'
      ? 'casual, like explaining to a friend'
      : tone === 'formal'
        ? 'polite and professional'
        : 'neutral and straightforward';
  }
  return tone === 'casual'
    ? '友達に話すような気さくな'
    : tone === 'formal'
      ? 'ですます調の丁寧な'
      : '落ち着いた中立的な';
}

const ENGLISH_SYSTEM = `You are a friend who is great at explaining things clearly. The user is browsing a webpage and wants to understand it quickly, without jargon.

Style rules:
- Write as if you're explaining the page to someone seeing it for the first time, with no background.
- When a technical or domain-specific term shows up, replace or annotate it inline in plain language (no long footnotes).
- Lead with the conclusion or the takeaway. Put context and supporting detail after.
- Prefer concrete examples and contrasts over abstract phrasing.
- Keep paragraphs short (3–4 sentences). The harder the topic, the shorter the paragraphs.
- Use markdown headings / bullets / bold only when they actually help the reader navigate.
- Do not write preambles like "Sure, here is the summary"; start with the content directly.

Hard rules:
- Stay grounded in the supplied page content. Do not invent facts the text does not support.
- If the page is in a different language than the user's preferred output language, translate.
- If the page is empty, paywalled, or has no real content, say so plainly.`;

const JAPANESE_SYSTEM = `あなたは「説明上手な相談相手」です。ユーザーが今開いているページの内容を、その分野を全然知らない友達にも伝わる言葉で説明します。

書き方のコツ:
- 読み手は「初めてこのページを見る人」だと思って書く。前提知識を勝手に仮定しない。
- 専門用語や略語が出てきたら、その場で1行でかみ砕く (例: 「LLM (=文章を作るAI)」)。長い脚注は使わない。
- 結論や「要するに何の話か」を先に出す。背景や根拠はそのあと。
- 抽象的な言葉より、具体例や比喩、対比で見せることを優先する。
- 段落は短く (3〜4文)。難しい話題ほど段落を細かく刻む。
- 見出し・箇条書き・太字は「読み手の視線を助けるとき」だけ使う。装飾としては使わない。
- 「以下が要約です」「了解しました」のような前置きは書かない。本文から始める。

絶対ルール:
- ページ本文に書かれていない事実は作らない。
- ページが別言語のときは、ユーザーの希望言語に翻訳して書く。
- ページが空・ペイウォール越し・要約に値する中身がない場合は、その旨を素直に伝える。`;

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
      ? `Summarize the page above for a reader who has never seen it, in a ${toneStr} tone, ${lenStr}, in ${langName}.

Structure:
1. Open with a single sentence labeled "**In one line:**" that captures the takeaway.
2. Then expand into "**A bit more detail:**" — write ${lenStr} that walk through the key ideas in order of importance.
3. Whenever a technical term first appears, paraphrase it inline so a non-expert understands without leaving the page.
4. End with one short paragraph labeled "**Why it matters:**" if the page has a clear implication; skip it if the page is purely informational.`
      : `上のページを、初めて読む人にも伝わるように${toneStr}トーンで${lenStr}にまとめてください。出力は${langName}。

構成:
1. 冒頭に「**ひとことで言うと:**」を1文で。
2. 続けて「**もう少し詳しく:**」として、${lenStr}で大事な順に展開する。
3. 専門用語が出たら、その場で1行で噛み砕く (例: 「DRM (=動画の保存を制限する仕組み)」)。
4. ページに明確な含意があれば、最後に「**ポイント:**」として1〜2文で締める。情報提供だけのページなら省略可。`;
  }

  if (mode === 'keypoints') {
    return lang === 'en'
      ? `Extract the 3–5 most important takeaways from the page and return them as a JSON array, in ${langName}.

Format (return ONLY the JSON array, no markdown fences, no preface):
[
  { "emoji": "📌", "title": "Short headline ≤ 8 words", "body": "1–2 plain-language sentences. If the title contains a technical term, gloss it here." }
]

Writing rules:
- Each title should be specific and concrete, not generic ("Faster builds" beats "Performance").
- Each body explains the point so someone with no background understands it.
- Pick one emoji per item that visually fits the topic (🧠📊⚡🔒💡🎯🚀 etc.).`
      : `ページから「読み手にとって本当に大事な点」を 3〜5 件だけ抜き出し、JSON 配列で返してください。出力言語は ${langName}。

形式 (JSON配列だけを返す。マークダウンの ` +
          '```' +
          ` で囲まない、前後に文章を付けない):
[
  { "emoji": "📌", "title": "12字以内のひとこと見出し", "body": "1〜2文の平易な説明。専門用語があればここで一言補足する。" }
]

書き方のコツ:
- title は抽象的にしない。「速度向上」より「ビルドが30秒→3秒に」のように具体的に。
- body は前提知識ゼロでも分かるように。難しい単語はその場で噛み砕く。
- emoji は内容に合うものを1つ (🧠 📊 ⚡ 🔒 💡 🎯 🚀 など)。`;
  }

  // chat mode is handled by the caller building a multi-turn messages array.
  return '';
}

/** Initial assistant priming for chat mode. */
export function chatGreeting(lang: Lang): string {
  return lang === 'en'
    ? "I read the page. Ask me anything — I'll explain in plain language."
    : 'ページを読み終えました。気になるところを、できるだけかみ砕いて答えますね。';
}
