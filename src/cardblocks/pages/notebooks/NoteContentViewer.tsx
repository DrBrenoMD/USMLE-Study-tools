import React from 'react';
import { renderCardText, cn } from '../../lib/utils';

interface NoteContentViewerProps {
  content?: string;
  forceRevealClozes?: boolean;
  onDoubleClick?: () => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
  title?: string;
}

export const NoteContentViewer: React.FC<NoteContentViewerProps> = ({
  content = '',
  forceRevealClozes = false,
  onDoubleClick,
  onClick,
  className = '',
  title = 'Dê duplo clique para editar'
}) => {
  if (!content || !content.trim()) {
    return (
      <div
        onDoubleClick={onDoubleClick}
        className={cn("p-2 text-sm text-gray-400 dark:text-gray-500 italic cursor-text select-none", className)}
        title={title}
      >
        Nota vazia. Dê duplo clique para editar...
      </div>
    );
  }

  const renderedHtml = renderCardText(content, forceRevealClozes);

  return (
    <div
      onDoubleClick={onDoubleClick}
      onClick={onClick}
      className={cn(
        "prose dark:prose-invert max-w-none text-sm text-gray-900 dark:text-gray-100 leading-relaxed cursor-text min-h-[32px] break-words",
        className
      )}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
      title={title}
    />
  );
};
