import React, { useRef, useEffect, useState } from 'react';

function SafeHtmlPiece({ html, className }: { html?: string, className?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState('auto');
  const [themeColor, setThemeColor] = useState('inherit');
  const [bgColor, setBgColor] = useState('transparent');

  const needsIsolation = html && (/<(style|script|link|iframe)\b/i.test(html) || html.includes('class="card"') || html.includes('nightMode') || html.includes("tab-content"));

  useEffect(() => {
    if (!needsIsolation) return;
    if (iframeRef.current && iframeRef.current.parentElement) {
      const parentStyle = window.getComputedStyle(iframeRef.current.parentElement);
      if (parentStyle.color) setThemeColor(parentStyle.color);
      
      let currentElement: HTMLElement | null = iframeRef.current.parentElement;
      let foundBg = 'transparent';
      while (currentElement) {
        const bg = window.getComputedStyle(currentElement).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          foundBg = bg;
          break;
        }
        currentElement = currentElement.parentElement;
      }
      setBgColor(foundBg);
    }
  }, [needsIsolation, html]);

  useEffect(() => {
    if (!needsIsolation) return;
    const handleMessage = (event: MessageEvent) => {
      if (iframeRef.current && event.source === iframeRef.current.contentWindow) {
        if (event.data && event.data.type === 'resize') {
          setHeight(`${event.data.height}px`);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [needsIsolation]);

  if (!html) return null;

  if (!needsIsolation) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const isFullDocument = html.trim().toLowerCase().startsWith('<!doctype') || html.trim().toLowerCase().startsWith('<html');

  let srcDoc = '';

  const resizerScript = `
    <script>
      let lastHeight = 0;
      function sendHeight() {
        const content = document.getElementById('content');
        let height = 0;
        if (content) {
          height = Math.ceil(content.getBoundingClientRect().height) + 16;
        } else {
          height = document.documentElement.scrollHeight || document.body.scrollHeight;
        }
        
        if (height !== lastHeight) {
          lastHeight = height;
          window.parent.postMessage({ type: 'resize', height }, '*');
        }
      }
      
      const observer = new MutationObserver(sendHeight);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      
      window.addEventListener('load', sendHeight);
      window.addEventListener('resize', sendHeight);
      
      sendHeight();
      setTimeout(sendHeight, 100);
      setTimeout(sendHeight, 500);

      window.switchTab = function(idx, groupId = '') {
        const contents = document.querySelectorAll('.tab-content' + (groupId ? '.'+groupId : ''));
        contents.forEach(el => el.style.display = 'none');
        
        const buttons = document.querySelectorAll('.tab-btn' + (groupId ? '.'+groupId : ''));
        buttons.forEach(el => el.classList.remove('active'));
        
        const target = document.getElementById('tab' + groupId + '-' + idx) || document.getElementById('tab' + idx);
        if (target) target.style.display = 'block';
        
        const allElements = document.querySelectorAll('[id^="tab-"], [id^="tab_"]');
        if (allElements.length > 0 && !target) {
            allElements.forEach(el => {
               if (el.classList.contains('tab-content')) el.style.display = 'none';
            });
            const t2 = document.getElementById('tab-' + idx) || document.getElementById('tab_' + idx);
            if (t2) t2.style.display = 'block';
        }
        
        sendHeight();
      };

      // Auto-recover media images if needed from parent media store
      document.querySelectorAll('img').forEach(function(img) {
        img.addEventListener('error', function() {
          const src = img.getAttribute('src');
          if (src && window.parent && window.parent.getAppMediaUrl) {
            const basename = src.split('/').pop() || src;
            window.parent.getAppMediaUrl(basename).then(function(newUrl) {
              if (newUrl) img.src = newUrl;
            });
          }
        });
      });
    </script>
  `;

  if (isFullDocument) {
    if (/<\/body>/i.test(html)) {
      srcDoc = html.replace(/<\/body>/i, resizerScript + '</body>');
    } else {
      srcDoc = html + resizerScript;
    }
  } else {
    srcDoc = `
      <!DOCTYPE html>
      <html style="background: ${bgColor} !important;">
        <head>
          <meta charset="utf-8">
          <meta name="color-scheme" content="dark">
          <style>
            :root {
              color-scheme: dark;
            }
            html, body {
              margin: 0;
              padding: 8px; /* Added padding for better visualization in iframes */
              font-family: Inter, ui-sans-serif, system-ui, sans-serif;
              color: ${themeColor} !important;
              overflow-y: hidden;
              background: ${bgColor} !important;
            }
            /* Override common Anki wrapper class backgrounds so they don't break dark mode */
            .card, .nightMode, #content, #front, #back, #details {
              background: ${bgColor} !important;
              background-color: ${bgColor} !important;
              color: ${themeColor} !important;
            }
            /* Basic resets for imported cards */
            a { color: #3b82f6; text-decoration: underline; }
            p, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, pre {
              margin-top: 0.5em;
              margin-bottom: 0.5em;
            }
            h1, h2, h3 { font-weight: bold; }
            h1 { font-size: 1.5em; }
            h2 { font-size: 1.25em; }
            h3 { font-size: 1.125em; }
            ul { list-style-type: disc; padding-left: 1.5em; }
            ol { list-style-type: decimal; padding-left: 1.5em; }
            blockquote { border-left: 4px solid #4b5563; padding-left: 1em; color: #9ca3af; }
            pre { background: #1f2937; padding: 1em; border-radius: 4px; overflow-x: auto; font-family: monospace; }
            code { font-family: monospace; background: #374151; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
            pre code { background: transparent; padding: 0; }
            img { max-width: 100%; height: auto; border-radius: 4px; }
            
            .cloze-hole {
              background-color: var(--primary, #6366f1);
              color: transparent;
              padding: 0 4px;
              border-radius: 4px;
              cursor: pointer;
              user-select: none;
              display: inline-block;
              transition: all 0.2s;
            }
            .cloze-hole.cloze-revealed {
              background-color: transparent;
              color: var(--primary, #6366f1);
              border-bottom: 2px solid var(--primary, #6366f1);
              border-radius: 0;
              padding: 0;
              cursor: text;
              user-select: text;
            }
          </style>
        </head>
        <body>
          <div id="content">${html}</div>
          ${resizerScript}
          <style>
            /* Forcefully applied at the end of the document to override any injected styles from the user's HTML */
            html, body, .card, .nightMode, #content, #front, #back, #details {
              background: ${bgColor} !important;
              background-color: ${bgColor} !important;
              color: ${themeColor} !important;
            }
          </style>
        </body>
      </html>
    `;
  }


  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      className={className}
      allowTransparency={true}
      style={{
        width: '100%',
        minHeight: '20px',
        height,
        border: 'none',
        overflow: 'hidden',
        background: 'transparent',
        backgroundColor: 'transparent',
        display: 'block',
        colorScheme: 'dark'
      }}
    />
  );
}

interface IsolatedHtmlProps {
  html?: string;
  frontHtml?: string;
  backHtml?: string;
  detailsHtml?: string;
  fields?: { name: string; value: string }[];
  className?: string;
  showBack?: boolean;
  layout?: 'vertical' | 'grid';
}

export function IsolatedHtml({ html, frontHtml, backHtml, detailsHtml, fields, className, showBack = false, layout = 'vertical' }: IsolatedHtmlProps) {
  const renderBackFields = () => {
    if (fields && fields.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
          {fields.map((f, i) => (
            <div 
              key={i} 
              style={{ 
                border: '1px solid rgba(148, 163, 184, 0.25)', 
                borderRadius: '12px', 
                padding: '12px 14px', 
                background: 'rgba(248, 250, 252, 0.6)' 
              }}
              className="dark:!bg-gray-800/40 dark:!border-gray-800"
            >
              <div style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                color: '#3b82f6', 
                textTransform: 'uppercase', 
                letterSpacing: '0.06em', 
                marginBottom: '6px',
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.1)'
              }}
              className="dark:text-blue-400 dark:bg-blue-950/50"
              >
                {f.name}
              </div>
              <div style={{ width: '100%', wordBreak: 'break-word' }}>
                <SafeHtmlPiece html={f.value} />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (backHtml) {
      return <SafeHtmlPiece html={backHtml} />;
    }

    return null;
  };

  if (layout === 'grid') {
    return (
      <div className={className} style={{ display: 'grid', gridTemplateColumns: showBack ? '1fr 1fr' : '1fr', gap: showBack ? '24px' : '0px' }}>
        {html && <SafeHtmlPiece html={html} />}
        {frontHtml && (
           <div>
             {showBack && (
               <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Frente</div>
             )}
             <SafeHtmlPiece html={frontHtml} />
           </div>
        )}
        {showBack && (
           <div style={{ borderLeft: '1px solid #374151', paddingLeft: '24px' }}>
             <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Verso & Blocos</div>
             {renderBackFields()}
             {detailsHtml && (
               <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #374151' }}>
                  <SafeHtmlPiece html={detailsHtml} />
               </div>
             )}
           </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {html && <SafeHtmlPiece html={html} />}
      {frontHtml && <SafeHtmlPiece html={frontHtml} />}
      {showBack && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #374151' }}>
           {renderBackFields()}
        </div>
      )}
      {showBack && detailsHtml && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #374151' }}>
           <SafeHtmlPiece html={detailsHtml} />
        </div>
      )}
    </div>
  );
}
