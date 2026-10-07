function mediaUrl(node: any): string | undefined {
  if (!node) return undefined;
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return mediaUrl(node[0]);
  return node?.$?.url || node?.url || node?.href || node?.['@_url'] || undefined;
}

export function extractMedia(item: any): {
  imageUrl?: string;
  videoUrl?: string;
  videoType?: string;
  mediaType: string;
} {
  const ytMatch = (
    (item.link || '') +
    ' ' +
    (item['content:encoded'] || '') +
    ' ' +
    (item.content || '') +
    ' ' +
    (item.enclosure?.url || '')
  ).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);

  if (ytMatch) {
    return {
      imageUrl: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
      videoUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      videoType: 'youtube',
      mediaType: 'video',
    };
  }

  const enclosureType = item.enclosure?.type ? String(item.enclosure.type) : '';
  const enclosureUrl =
    item.enclosure?.url && (!enclosureType || enclosureType.startsWith('image/'))
      ? item.enclosure.url
      : undefined;
  const imageUrl =
    enclosureUrl ||
    item['media:content']?.['$']?.url ||
    item['media:thumbnail']?.['$']?.url ||
    mediaUrl(item['media:content']) ||
    mediaUrl(item['media:thumbnail']) ||
    item.itunes?.image ||
    null;

  return { imageUrl: imageUrl || undefined, mediaType: 'article' };
}
