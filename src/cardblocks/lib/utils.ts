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
  return html;
}

export function renderCardText(html?: string, forceRevealCloze: boolean = false) {
  if (!html) return '';
  // Replace {{c1::answer}} with interactive cloze span
  let parsed = html.replace(/{{c\d*::(.*?)(?:::.*?)?}}/g, (match, p1) => {
    const safeAnswer = escapeHtml(p1);
    const content = forceRevealCloze ? safeAnswer : '[...]';
    const classes = forceRevealCloze ? 'cloze-hole cloze-revealed' : 'cloze-hole';
    return `<span class="${classes}" onclick="this.classList.add('cloze-revealed'); this.innerHTML = this.getAttribute('data-answer'); event.stopPropagation();" data-answer="${safeAnswer}">${content}</span>`;
  });
  return sanitizeHtml(parsed);
}
