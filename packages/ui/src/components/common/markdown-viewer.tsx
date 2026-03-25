import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewerProps {
  content: string
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-stone max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-medium text-stone-900 mb-4 mt-0 leading-tight first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-medium text-stone-900 mb-3 mt-6 leading-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium text-stone-900 mb-2 mt-5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-medium text-stone-900 mb-2 mt-4">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[14px] text-stone-700 leading-[1.7] mb-3">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc text-[14px] text-stone-700 mb-3 space-y-1.5 pl-5 leading-[1.7]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal text-[14px] text-stone-700 mb-3 space-y-1.5 pl-5 leading-[1.7]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-[14px] text-stone-700 pl-0.5">
              {children}
            </li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-900 underline underline-offset-2 decoration-stone-300 hover:decoration-stone-500 transition-colors"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isInline = !className
            if (isInline) {
              return (
                <code className="bg-stone-100 text-stone-800 px-1.5 py-0.5 rounded text-[13px] font-mono">
                  {children}
                </code>
              )
            }
            return <code className={className}>{children}</code>
          },
          pre: ({ children }) => (
            <pre className="bg-stone-900 text-stone-100 p-4 rounded-lg overflow-x-auto text-[13px] font-mono mb-4 leading-relaxed">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-stone-200 pl-4 text-stone-600 my-4 text-[14px] leading-[1.7]">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-stone-100 my-6" />,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4 rounded-lg border border-stone-200">
              <table className="min-w-full text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-stone-50 border-b border-stone-200">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-stone-100">{children}</tbody>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-medium text-stone-500 uppercase tracking-wide">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-stone-700">{children}</td>
          ),
          strong: ({ children }) => (
            <strong className="font-medium text-stone-900">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
