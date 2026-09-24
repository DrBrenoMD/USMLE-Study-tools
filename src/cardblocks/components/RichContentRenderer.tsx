import React, { useMemo } from 'react';

interface RichContentRendererProps {
  content?: string;
  className?: string;
  onTextSelected?: (selectedText: string) => void;
}

export const RichContentRenderer: React.FC<RichContentRendererProps> = ({
  content = '',
  className = '',
}) => {
  const isHtml = useMemo(() => {
    if (!content) return false;
    return /<(?:table|thead|tbody|tr|td|th|img|div|p|ul|ol|li|b|strong|i|em|h[1-6]|mark|span|br)\b/i.test(content);
  }, [content]);

  if (!content) return null;

  if (isHtml) {
    // Processa tabelas, imagens e trechos com highlight
    let processedHtml = content
      .replace(/<table\b/gi, '<div class="overflow-x-auto my-3 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xs"><table class="w-full border-collapse text-xs sm:text-sm text-left"')
      .replace(/<\/table>/gi, '</table></div>')
      .replace(/<th\b/gi, '<th class="p-2.5 sm:p-3 bg-gray-100 dark:bg-gray-800 font-bold border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"')
      .replace(/<td\b/gi, '<td class="p-2.5 sm:p-3 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200"')
      .replace(/<img\b([^>]*)>/gi, (match, attrs) => {
        if (!attrs.includes('class=')) {
          return `<img ${attrs} class="max-h-80 max-w-full rounded-xl my-3 shadow-xs border border-gray-200 dark:border-gray-700 object-contain mx-auto block cursor-pointer" />`;
        }
        return match;
      })
      .replace(/<mark\b([^>]*)>/gi, (match, attrs) => {
        if (!attrs.includes('class=')) {
          return `<mark ${attrs} class="bg-amber-200 dark:bg-amber-400/40 text-gray-900 dark:text-gray-100 px-1 py-0.5 rounded font-medium shadow-2xs border-b border-amber-400/50 inline">`;
        }
        return match;
      });

    return (
      <div
        className={`rich-content prose dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 leading-relaxed ${className}`}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    );
  }

  return (
    <div className={`whitespace-pre-wrap leading-relaxed text-gray-900 dark:text-gray-100 ${className}`}>
      {content}
    </div>
  );
};
