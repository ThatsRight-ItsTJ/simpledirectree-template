import { cn } from "@/lib/utils";
import { getCMSImageUrl } from "@/lib/cms/fetch";
import Link from "next/link";

// Content block types for the new CMS structure
export interface ContentBlock {
  type: string;
  children?: any[];
  attrs?: Record<string, any>;
}

export interface ContentData {
  content: ContentBlock[];
}

/**
 * Custom content renderer to replace PortableText
 * This handles the simplified JSON structure from the new CMS
 */
export default function ContentRenderer({
  className,
  content,
}: {
  className?: string;
  content: ContentData | ContentBlock[] | string;
}) {
  // Handle different input types
  let blocks: ContentBlock[];
  
  if (typeof content === 'string') {
    // If it's a string, wrap it in a paragraph
    blocks = [{ type: 'paragraph', children: [{ text: content }] }];
  } else if (Array.isArray(content)) {
    blocks = content;
  } else if (content && 'content' in content) {
    blocks = content.content;
  } else {
    blocks = [];
  }

  const renderBlock = (block: ContentBlock, index: number) => {
    const { type, children = [], attrs = {} } = block;

    switch (type) {
      case 'paragraph':
        return (
          <p key={index} className="mb-4 leading-7 [&:not(:first-child)]:mt-6">
            {renderInlineContent(children)}
          </p>
        );

      case 'heading':
        const level = parseInt(attrs.level || '2') || 2;
        const HeadingTag = `h${Math.min(Math.max(level, 1), 6)}` as keyof JSX.IntrinsicElements;
        const headingClasses = {
          1: "text-4xl font-bold mb-6 mt-8",
          2: "text-3xl font-semibold mb-5 mt-7",
          3: "text-2xl font-semibold mb-4 mt-6",
          4: "text-xl font-semibold mb-3 mt-5",
          5: "text-lg font-semibold mb-3 mt-4",
          6: "text-base font-semibold mb-2 mt-3",
        };
        
        return (
          <HeadingTag 
            key={index} 
            className={cn(headingClasses[level as keyof typeof headingClasses], "scroll-m-20 dark:text-foreground")}
          >
            {renderInlineContent(children)}
          </HeadingTag>
        );

      case 'blockquote':
        return (
          <blockquote 
            key={index} 
            className="mt-6 border-l-2 pl-6 italic [&>*]:text-muted-foreground"
          >
            {renderInlineContent(children)}
          </blockquote>
        );

      case 'list':
        const ListTag = attrs.ordered ? 'ol' : 'ul';
        const listClasses = "my-6 ml-6 list-disc [&>li]:mt-2";
        const orderedListClasses = "my-6 ml-6 list-decimal [&>li]:mt-2";
        
        return (
          <ListTag 
            key={index} 
            className={attrs.ordered ? orderedListClasses : listClasses}
          >
            {children.map((child, childIndex) => (
              <li key={childIndex}>{renderInlineContent(child.children || [])}</li>
            ))}
          </ListTag>
        );

      case 'image':
        const imageUrl = attrs.url || attrs.src;
        const altText = attrs.alt || '';
        const caption = attrs.caption || '';
        
        if (!imageUrl) return null;

        return (
          <div key={index} className="my-6">
            <img
              src={getCMSImageUrl(imageUrl, 960, 540)}
              alt={altText}
              title={caption}
              className="rounded-lg w-full"
              loading="lazy"
            />
            {caption && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {caption}
              </p>
            )}
          </div>
        );

      case 'link':
        const href = attrs.href;
        if (!href) return null;
        
        return (
          <Link 
            key={index}
            href={href}
            target={attrs.newWindow ? '_blank' : '_self'}
            rel={attrs.newWindow ? 'noopener noreferrer' : undefined}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            {renderInlineContent(children)}
          </Link>
        );

      case 'code':
        const isBlock = attrs.pre || false;
        const codeContent = children.map(child => child.text).join('');
        
        if (isBlock) {
          return (
            <pre key={index} className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
              <code className="text-sm">{codeContent}</code>
            </pre>
          );
        }
        
        return (
          <code key={index} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
            {codeContent}
          </code>
        );

      case 'divider':
        return (
          <hr key={index} className="my-8 border-t border-border" />
        );

      default:
        // Unknown block type, render as paragraph
        return (
          <div key={index} className="mb-4">
            {renderInlineContent(children)}
          </div>
        );
    }
  };

  const renderInlineContent = (inlineContent: any[]) => {
    return inlineContent.map((child, index) => {
      if (typeof child === 'string') {
        return child;
      }

      if (!child.text) return null;

      const { text, marks = [] } = child;

      return marks.reduce((element: React.ReactNode, mark: string) => {
        switch (mark) {
          case 'bold':
            return <strong key={index}>{element}</strong>;
          case 'italic':
            return <em key={index}>{element}</em>;
          case 'underline':
            return <u key={index}>{element}</u>;
          case 'strikethrough':
            return <s key={index}>{element}</s>;
          case 'code':
            return <code key={index} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{element}</code>;
          case 'link':
            // Link handling should be done at the block level
            return element;
          default:
            return element;
        }
      }, text);
    });
  };

  return (
    <div className={cn("prose prose-gray dark:prose-invert max-w-none", className)}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

/**
 * Helper function to render content in specific contexts
 */
export function renderContentInContext(
  content: ContentData | ContentBlock[] | string,
  context: 'excerpt' | 'full' = 'full'
): React.ReactNode {
  if (context === 'excerpt' && typeof content === 'object' && !Array.isArray(content)) {
    // For excerpt, we might want to limit the content length
    // This is a simple implementation - you can enhance it based on your needs
    const blocks = Array.isArray(content.content) ? content.content : [];
    const maxBlocks = context === 'excerpt' ? 2 : blocks.length;
    const limitedContent = { content: blocks.slice(0, maxBlocks) };
    return <ContentRenderer content={limitedContent} />;
  }
  
  return <ContentRenderer content={content} />;
}