import React, { useEffect, useRef } from 'react';

export const AutoHighlighter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const container = containerRef.current;
      if (!container || !container.contains(selection.anchorNode)) return;

      try {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.className = "bg-yellow-200/50 dark:bg-yellow-500/30 text-inherit m-0 p-0 cursor-pointer highlight-span";
        span.style.letterSpacing = 'inherit';
        span.style.font = 'inherit';
        span.onclick = (e) => {
          const target = e.currentTarget as HTMLElement;
          const parent = target.parentNode;
          if (parent) {
             while (target.firstChild) {
                parent.insertBefore(target.firstChild, target);
             }
             parent.removeChild(target);
             parent.normalize();
          }
        };

        span.appendChild(range.extractContents());
        range.insertNode(span);
        selection.removeAllRanges();
      } catch (e) {
        console.error(e);
      }
    };
    
    // Attack click handlers to existing spans
    const attachClickHandlers = () => {
       if (containerRef.current) {
          const spans = containerRef.current.querySelectorAll('.highlight-span');
          spans.forEach(span => {
             (span as HTMLElement).onclick = (e) => {
                const target = e.currentTarget as HTMLElement;
                const parent = target.parentNode;
                if (parent) {
                   while (target.firstChild) {
                      parent.insertBefore(target.firstChild, target);
                   }
                   parent.removeChild(target);
                   parent.normalize();
                }
             };
          });
       }
    };

    const container = containerRef.current;
    if (container) {
       container.addEventListener("mouseup", handleMouseUp);
       container.addEventListener("touchend", handleMouseUp);
       attachClickHandlers();
    }
    return () => {
       if (container) {
         container.removeEventListener("mouseup", handleMouseUp);
         container.removeEventListener("touchend", handleMouseUp);
       }
    };
  }, [children]); // Re-attach when children change

  return <div ref={containerRef} className={className}>{children}</div>;
};
