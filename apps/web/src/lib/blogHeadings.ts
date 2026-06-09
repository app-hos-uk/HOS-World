export interface TocItem {
  id: string;
  text: string;
  level: number;
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
  '&copy;': '\u00A9',
  '&reg;': '\u00AE',
  '&trade;': '\u2122',
  '&mdash;': '\u2014',
  '&ndash;': '\u2013',
  '&hellip;': '\u2026',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&ldquo;': '\u201C',
  '&rdquo;': '\u201D',
  '&bull;': '\u2022',
  '&middot;': '\u00B7',
  '&times;': '\u00D7',
  '&divide;': '\u00F7',
  '&plusmn;': '\u00B1',
  '&deg;': '\u00B0',
  '&frac12;': '\u00BD',
  '&frac14;': '\u00BC',
  '&frac34;': '\u00BE',
};

function decodeHtmlEntities(text: string): string {
  // Decode named entities
  let decoded = text.replace(/&[a-zA-Z0-9]+;/g, (entity) => {
    return HTML_ENTITIES[entity.toLowerCase()] ?? HTML_ENTITIES[entity] ?? entity;
  });
  // Decode numeric entities (decimal)
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  // Decode numeric entities (hex)
  decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return decoded;
}

function stripHtml(html: string): string {
  const textOnly = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return decodeHtmlEntities(textOnly);
}

/**
 * Assigns sequential section-* IDs to h2/h3 headings and builds the ToC
 * from the same pass so anchor links always match rendered heading IDs.
 */
export function processBlogHeadings(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  let index = 0;

  const processedHtml = html.replace(
    /<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, attrs: string, content: string) => {
      const id = `section-${index}`;
      const level = tag.toLowerCase() === 'h2' ? 2 : 3;
      const text = stripHtml(content);

      const attrsWithoutId = attrs
        .replace(/\s*id\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const attrPrefix = attrsWithoutId ? ` ${attrsWithoutId}` : '';

      if (text) {
        toc.push({ id, text, level });
      }

      index += 1;
      return `<${tag}${attrPrefix} id="${id}">${content}</${tag}>`;
    },
  );

  return { html: processedHtml, toc };
}
