/**
 * Ambient type declarations for the extension.
 * - `import.meta.glob` (Vite)
 * - WXT-provided module references
 */

interface ImportMeta {
  readonly glob: <T = unknown>(
    pattern: string,
    options?: { eager?: boolean; import?: string; as?: string },
  ) => Record<string, T>;
  readonly env: Record<string, string | undefined>;
}
