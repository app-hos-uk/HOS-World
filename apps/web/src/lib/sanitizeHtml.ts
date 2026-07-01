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
      '*': ['class', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

/** Wrap email HTML so iframe preview uses a white canvas (avoids dark-admin-theme bleed). */
export function wrapEmailPreviewDocument(html: string): string {
  const body = sanitizeEmailPreviewHtml(html);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:16px;background:#ffffff;color:#1a1a1a;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;}
    a{color:#2563eb;} table{border-collapse:collapse;}
  </style></head><body>${body}</body></html>`;
}

const BLOG_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'a', 'code', 'pre', 'span', 'div', 'hr',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'img', 'figure', 'figcaption', 'video', 'source',
  'iframe', 'section', 'article',
];

export function sanitizeBlogHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: BLOG_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
      video: ['src', 'controls', 'width', 'height'],
      source: ['src', 'type'],
      '*': ['class', 'id'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com'],
  });
}
