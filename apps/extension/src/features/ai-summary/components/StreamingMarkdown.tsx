import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  h1: ({ node, ...p }) => (
    <h1 className="text-fg-default mb-2 mt-3 text-base font-semibold tracking-tight" {...p} />
  ),
  h2: ({ node, ...p }) => (
    <h2 className="text-fg-default mb-1.5 mt-3 text-sm font-semibold" {...p} />
  ),
  h3: ({ node, ...p }) => (
    <h3
      className="text-fg-default mb-1 mt-2 text-xs font-semibold uppercase tracking-wider"
      {...p}
    />
  ),
  p: ({ node, ...p }) => <p className="my-1.5 text-sm leading-relaxed" {...p} />,
  ul: ({ node, ...p }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5 text-sm" {...p} />,
  ol: ({ node, ...p }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5 text-sm" {...p} />,
  li: ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
  a: ({ node, ...p }) => (
    <a
      className="text-accent-600 underline-offset-2 hover:underline"
      target="_blank"
      rel="noreferrer noopener"
      {...p}
    />
  ),
  strong: ({ node, ...p }) => <strong className="text-fg-default font-semibold" {...p} />,
  em: ({ node, ...p }) => <em className="italic" {...p} />,
  code: ({ node, className, children, ...p }) => {
    const inline = !className?.includes('language-');
    if (inline) {
      return (
        <code
          className="bg-surface-muted text-fg-default rounded px-1 py-0.5 font-mono text-[11px]"
          {...p}
        >
          {children}
        </code>
      );
    }
    return (
      <code className="font-mono text-[11px]" {...p}>
        {children}
      </code>
    );
  },
  pre: ({ node, ...p }) => (
    <pre
      className="my-2 overflow-x-auto rounded-md bg-neutral-950 p-3 text-[11px] text-neutral-100"
      {...p}
    />
  ),
  blockquote: ({ node, ...p }) => (
    <blockquote className="border-accent-500/40 text-fg-muted my-2 border-l-2 pl-3 italic" {...p} />
  ),
  hr: () => <hr className="border-border my-3" />,
};

interface Props {
  text: string;
}

export function StreamingMarkdown({ text }: Props) {
  return (
    <div className="text-fg-default">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
