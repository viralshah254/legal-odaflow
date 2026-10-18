"use client"

import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import { cn } from "@/lib/utils"
import { isSafeNavigableUrl } from "@/lib/security/safe-url"

interface LegalMarkdownProps {
  content: string
  className?: string
}

const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
  },
}

const markdownComponents: Components = {
  a: ({ href, children, ...props }) => {
    if (!href || !isSafeNavigableUrl(href)) {
      return <span>{children}</span>
    }

    const external = href.startsWith("http://") || href.startsWith("https://")
    return (
      <a
        href={href}
        {...props}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    )
  },
}

export function LegalMarkdown({ content, className }: LegalMarkdownProps) {
  if (!content?.trim()) {
    return null
  }

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:tracking-tight prose-headings:text-foreground",
        "prose-h1:text-xl prose-h1:font-bold prose-h1:mt-0 prose-h1:mb-3",
        "prose-h2:text-base prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-2",
        "prose-h2:border-l-2 prose-h2:border-primary prose-h2:pl-3",
        "prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-1",
        "prose-p:leading-relaxed prose-p:text-foreground/90",
        "prose-strong:text-foreground prose-strong:font-bold",
        "prose-em:text-foreground/80",
        "prose-li:my-1 prose-li:leading-relaxed",
        "prose-ul:my-3 prose-ol:my-3",
        "prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-md prose-blockquote:py-1",
        "prose-code:text-primary prose-code:bg-primary/10 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs",
        "prose-hr:my-6 prose-hr:border-border",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema]]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
