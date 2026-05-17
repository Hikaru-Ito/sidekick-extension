import type { KeyPoint } from '../../ai-summary/types';
import type { ReadLaterItem } from '../types';

/** Variables that can appear in webhook body templates. */
export interface TemplateContext {
  title: string;
  url: string;
  hostname: string;
  description: string;
  tags: string; // comma-joined
  notes: string;
  savedAt: string; // ISO
  summary: string; // markdown text (overview + key points combined)
  overview: string;
  keypoints: string; // markdown bullet list
  /** Cover image absolute URL (empty when none was found). Usable in {{#image}}…{{/image}} sections. */
  image: string;
}

export function buildContext(item: ReadLaterItem): TemplateContext {
  const summaryText = formatSummary(item);
  return {
    title: item.title,
    url: item.url,
    hostname: item.hostname,
    description: item.description,
    tags: item.tags.join(', '),
    notes: item.notes,
    savedAt: new Date(item.savedAt).toISOString(),
    summary: summaryText,
    overview: item.summary?.overview ?? '',
    keypoints: formatKeyPoints(item.summary?.keypoints ?? []),
    image: item.image ?? '',
  };
}

function formatKeyPoints(points: KeyPoint[]): string {
  return points.map((p, i) => `${i + 1}. ${p.emoji} **${p.title}** — ${p.body}`).join('\n');
}

function formatSummary(item: ReadLaterItem): string {
  if (!item.summary) return '';
  const parts: string[] = [];
  if (item.summary.keypoints.length > 0) {
    parts.push(formatKeyPoints(item.summary.keypoints));
  }
  if (item.summary.overview) {
    if (parts.length > 0) parts.push('');
    parts.push(item.summary.overview);
  }
  return parts.join('\n');
}

/**
 * Mustache-flavoured template renderer.
 *
 * Supported:
 *   {{var}}         — substitution
 *   {{#var}}…{{/var}} — section: rendered only when var is truthy
 *
 * Templates are intentionally minimal — no helpers, no loops over arrays.
 * That keeps webhook body authoring obvious and safe to evaluate in a SW.
 */
export function renderTemplate(template: string, ctx: TemplateContext): string {
  // Strip JSON-incompatible characters first when escaping for JSON below.
  const sectionRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let out = template.replace(sectionRegex, (_full, name, body) => {
    const value = (ctx as unknown as Record<string, string>)[name];
    return value && value.trim().length > 0 ? body : '';
  });
  const varRegex = /\{\{(\w+)\}\}/g;
  out = out.replace(varRegex, (_full, name) => {
    const value = (ctx as unknown as Record<string, string>)[name];
    return value ?? '';
  });
  return out;
}

/** Renders for a JSON body — escapes string substitutions. */
export function renderJsonTemplate(template: string, ctx: TemplateContext): string {
  // For section blocks we still pass through; the value is a JSON-quoted
  // string when present, but inside JSON bodies users typically wrap the
  // variable in quotes themselves. Escape *substitutions* so quotes/newlines
  // don't break the JSON.
  const sectionRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let out = template.replace(sectionRegex, (_full, name, body) => {
    const value = (ctx as unknown as Record<string, string>)[name];
    return value && value.trim().length > 0 ? body : '';
  });
  const varRegex = /\{\{(\w+)\}\}/g;
  out = out.replace(varRegex, (_full, name) => {
    const value = (ctx as unknown as Record<string, string>)[name] ?? '';
    return JSON.stringify(value).slice(1, -1); // strip surrounding quotes
  });
  return out;
}
