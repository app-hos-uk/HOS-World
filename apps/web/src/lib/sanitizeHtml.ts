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

const SVG_TAGS = [
  'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'ellipse', 'g', 'defs', 'use', 'text', 'tspan', 'clipPath', 'mask',
  'linearGradient', 'radialGradient', 'stop', 'title', 'desc',
];

const SVG_ATTRS = [
  'viewBox', 'xmlns', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y',
  'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform',
  'opacity', 'clip-path', 'mask', 'id', 'class', 'offset', 'stop-color',
  'stop-opacity', 'gradientUnits', 'gradientTransform',
];

export function sanitizeSvgHtml(svg: string): string {
  return sanitizeHtmlLib(svg, {
    allowedTags: SVG_TAGS,
    allowedAttributes: { '*': SVG_ATTRS },
    allowedSchemes: [],
    parser: { lowerCaseAttributeNames: false },
  });
}
