import sanitizeHtmlLib from 'sanitize-html';

const CMS_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
  'blockquote', 'a', 'code', 'pre', 'span', 'div', 'hr',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'img', 'figure', 'figcaption',
];

export function sanitizeCmsHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: CMS_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}
