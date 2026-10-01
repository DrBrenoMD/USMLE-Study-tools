import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import DOMPurify from 'dompurify';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatShortcutEvent(e: any): string {
  const keys = [];
  if (e.ctrlKey || e.metaKey) keys.push('ctrl');
  if (e.shiftKey) keys.push('shift');
  if (e.altKey) keys.push('alt');
  const key = e.key === ' ' ? 'space' : e.key.toLowerCase();
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
    keys.push(key);
  }
  return keys.join('+');
}

export function matchShortcut(e: any, shortcutConfig: string): boolean {
  if (!shortcutConfig) return false;
  
  // Normalize config from old format ' ' to 'space'
  let normalizedConfig = shortcutConfig === ' ' ? 'space' : shortcutConfig;
  
  // Also support multiple shortcuts separated by '|' or just array if needed.
  // The prompt asks for "shift+ctrl+z or ctrl+y" for redo, so we can support 'ctrl+shift+z|ctrl+y' or similar.
  const configs = normalizedConfig.split('|');
  const pressed = formatShortcutEvent(e);
  
  return configs.includes(pressed);
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const escapeHtml = (unsafe: string) => {
  return unsafe
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
};

export function sanitizeHtml(html?: string) {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'b', 'strong',
      'i', 'em', 'u', 's', 'strike', 'ul', 'ol', 'li', 'blockquote', 'hr',
      'br', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'video', 'audio', 'details', 'summary', 'mark', 'sub', 'sup',
      'svg', 'path', 'input', 'button', 'a', 'section', 'article', 'aside',
      'figure', 'figcaption', 'kbd', 'abbr'
    ],
    ALLOWED_ATTR: [
      'class', 'style', 'src', 'alt', 'title', 'href', 'target', 'rel',
      'data-*', 'data-cloze', 'data-answer', 'data-hint', 'data-revealed',
      'width', 'height', 'controls', 'type', 'checked', 'disabled',
      'viewBox', 'fill', 'stroke', 'stroke-width', 'id', 'name', 'colspan', 'rowspan'
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onmouseover', 'onfocus', 'onblur'],
    ALLOW_DATA_ATTR: true,
  });
}

export function renderCardText(html?: string, forceRevealCloze: boolean = false) {
  if (!html) return '';
  // Replace {{c1::answer}} with interactive cloze span
  let parsed = html.replace(/{{c(\d*)::(.*?)(?:::.*?)?}}/g, (_match, _num, p1) => {
    const safeAnswer = escapeHtml(p1);
    const content = forceRevealCloze ? safeAnswer : '[...]';
    const classes = forceRevealCloze ? 'cloze-hole cloze-revealed' : 'cloze-hole';
    return `<span class="${classes}" data-answer="${safeAnswer}" data-revealed="${forceRevealCloze}">${content}</span>`;
  });
  return sanitizeHtml(parsed);
}

export function renderNoteContentWithClozes(html?: string, forceRevealCloze: boolean = false) {
  if (!html) return '';
  const sanitized = sanitizeHtml(html);
  
  // Replaces Anki style cloze deletions {{c1::answer}} or {{c1::answer::hint}} with interactive cloze spans
  return sanitized.replace(/{{c(\d*)::(.*?)(?:::([^}]*))?}}/g, (_match, clozeNum, answer, hint) => {
    const safeAnswer = escapeHtml(answer);
    const safeHint = hint ? escapeHtml(hint) : '';
    const clozeLabel = safeHint ? `[${safeHint}]` : `[...]`;
    const content = forceRevealCloze ? safeAnswer : clozeLabel;
    const classes = forceRevealCloze
      ? 'cloze-hole cloze-revealed px-1.5 py-0.5 rounded font-bold cursor-pointer transition-all inline-flex items-center text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
      : 'cloze-hole px-1.5 py-0.5 rounded font-bold cursor-pointer transition-all inline-flex items-center text-blue-700 bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800 hover:scale-105';

    return `<span class="${classes}" data-note-cloze="true" data-cloze-num="${clozeNum || '1'}" data-answer="${safeAnswer}" data-hint="${safeHint}" data-revealed="${forceRevealCloze ? 'true' : 'false'}" title="${forceRevealCloze ? 'Clique para ocultar' : 'Clique para revelar a resposta'}">${content}</span>`;
  });
}
