import type { ComponentPropsWithoutRef } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

const INLINE_CODE_CLASSNAME =
  "rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[0.92em] text-inherit";

function getSafeHref(href: string | undefined): string | null {
  if (!href) {
    return null;
  }

  const normalizedHref = href.trim();
  if (!normalizedHref) {
    return null;
  }

  if (normalizedHref.startsWith("#") || normalizedHref.startsWith("/")) {
    return normalizedHref;
  }

  try {
    const url = new URL(normalizedHref, "https://pillow-council.local");
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:" ? normalizedHref : null;
  } catch {
    return null;
  }
}

function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:");
}

function Link({ className, href, rel, target, ...props }: ComponentPropsWithoutRef<"a">) {
  const safeHref = getSafeHref(href);

  if (!safeHref) {
    return <span className={className}>{props.children}</span>;
  }

  const external = isExternalHref(safeHref);

  return (
    <a
      {...props}
      href={safeHref}
      className={cn(
        "font-medium text-blue-300 underline decoration-blue-400/40 underline-offset-4 transition hover:text-blue-200",
        className
      )}
      rel={external ? (rel ?? "noreferrer noopener") : rel}
      target={external ? (target ?? "_blank") : target}
    />
  );
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "max-w-none break-words text-inherit [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:break-all [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-white/10 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:font-mono [&_hr]:my-4 [&_hr]:border-white/10 [&_li>p]:my-0 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/30 [&_pre]:p-4 [&_strong]:font-semibold [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-white/10 [&_tbody_tr]:border-t [&_tbody_tr]:border-white/10 [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2 [&_th]:bg-white/5 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_tr]:align-top [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ className: anchorClassName, ...props }) => <Link {...props} className={anchorClassName} />,
          code: ({ className: codeClassName, children, node, ...props }) => {
            const isBlock =
              codeClassName?.includes("language-") ||
              (node?.position?.start.line !== undefined &&
                node.position.end.line !== undefined &&
                node.position.start.line !== node.position.end.line);

            if (isBlock) {
              return (
                <code {...props} className={cn("block min-w-full font-mono text-[0.92em] text-inherit", codeClassName)}>
                  {children}
                </code>
              );
            }

            return (
              <code {...props} className={cn(INLINE_CODE_CLASSNAME, codeClassName)}>
                {children}
              </code>
            );
          },
          h1: ({ className: headingClassName, ...props }) => (
            <h1 {...props} className={cn("mt-6 text-2xl font-semibold tracking-tight", headingClassName)} />
          ),
          h2: ({ className: headingClassName, ...props }) => (
            <h2 {...props} className={cn("mt-6 text-xl font-semibold tracking-tight", headingClassName)} />
          ),
          h3: ({ className: headingClassName, ...props }) => (
            <h3 {...props} className={cn("mt-5 text-lg font-semibold tracking-tight", headingClassName)} />
          ),
          h4: ({ className: headingClassName, ...props }) => (
            <h4 {...props} className={cn("mt-4 text-base font-semibold tracking-tight", headingClassName)} />
          ),
          p: ({ className: paragraphClassName, ...props }) => <p {...props} className={cn("leading-7", paragraphClassName)} />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
