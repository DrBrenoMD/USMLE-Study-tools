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
      'b', 'i', 'em', 'strong', 'a', 'p', 'div', 'span', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'blockquote', 'hr', 'br', 'pre', 'code', 'mark',
      'figure', 'figcaption', 'input', 'button', 'svg', 'path', 'iframe'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'src', 'alt', 'class', 'style', 'title', 'width', 'height', 'data-answer', 'data-cloze-index',
      'data-miniaturized', 'data-original-width', 'data-original-height', 'type', 'checked', 'disabled', 'viewbox',
      'fill', 'stroke', 'stroke-width', 'd', 'xmlns', 'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing', 'onclick'
    ]
  });
}

export function renderCardText(html?: string, forceRevealCloze: boolean = false) {
  if (!html) return '';
  // Replace {{c1::answer}} with interactive cloze span
  let parsed = html.replace(/{{c\d*::(.*?)(?:::.*?)?}}/g, (match, p1) => {
    const safeAnswer = escapeHtml(p1);
    const content = forceRevealCloze ? safeAnswer : '[...]';
    const classes = forceRevealCloze ? 'cloze-hole cloze-revealed' : 'cloze-hole';
    return `<span class="${classes}" onclick="this.classList.toggle('cloze-revealed'); this.innerHTML = this.classList.contains('cloze-revealed') ? this.getAttribute('data-answer') : '[...]'; event.stopPropagation();" data-answer="${safeAnswer}" title="Clique para revelar / ocultar">${content}</span>`;
  });
  return sanitizeHtml(parsed);
}
