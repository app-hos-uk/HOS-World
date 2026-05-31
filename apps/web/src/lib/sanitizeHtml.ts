import sanitizeHtmlLib from 'sanitize-html';

const KB_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
  'blockquote', 'a', 'code', 'pre', 'span', 'div', 'hr',
];

export function sanitizeKbHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: KB_TAGS,
    allowedAttributes: {
      a: ['href', 'title'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

export function sanitizeSearchHighlight(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ['mark'],
    allowedAttributes: {},
  });
}

export function sanitizeEmailPreviewHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: [...KB_TAGS, 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img'],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['align', 'valign'],
      th: ['align', 'valign'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}
