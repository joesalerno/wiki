export const API_URL = 'http://localhost:3001/api';

export async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Simple Markdown parser (very minimal)
export function parseMarkdown(text) {
    if (!text) return '';

    // Basic HTML escaping to prevent XSS
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    html = html
        // Headers
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        // Bold
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        // Lists
        .replace(/^\s*-\s(.*$)/gim, '<li>$1</li>')
        // Paragraphs (double newline)
        .replace(/\n\n/gim, '<br/><br/>');

    // Wrap lists in ul (simple approximation)
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>').replace(/<\/ul><ul>/gim, '');

    return html;
}
