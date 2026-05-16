/**
 * Sidekick extension の補助型定義。
 * - import.meta.glob (Vite)
 * - WXTのモジュール参照
 */

interface ImportMeta {
  readonly glob: <T = unknown>(
    pattern: string,
    options?: { eager?: boolean; import?: string; as?: string },
  ) => Record<string, T>;
  readonly env: Record<string, string | undefined>;
}
