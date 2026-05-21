export function normalizeNoteBody(value) {
  return typeof value === 'string' ? value.trimEnd() : '';
}

export function isProbablyHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(value ?? '');
}

export function htmlToPlainText(html) {
  if (!html) return '';

  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getPlainNoteBody(value) {
  if (!value) return '';

  return isProbablyHtml(value) ? htmlToPlainText(value) : value;
}

export function isEmptyNote(value) {
  return !getPlainNoteBody(value).trim();
}

export function getEditorInitialHtml(value) {
  // Bleibt nur aus Kompatibilität bestehen, falls irgendwo noch importiert.
  return getPlainNoteBody(value);
}

export function plainTextToHtml(value) {
  // Bleibt nur aus Kompatibilität bestehen, wird im Editor nicht mehr genutzt.
  return typeof value === 'string' ? value : '';
}

export function getNoteTitle(body) {
  const plain = getPlainNoteBody(body);

  if (!plain.trim()) return 'Neue Notiz';

  const lines = plain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return 'Neue Notiz';

  const title = lines[0];

  return title.length > 60 ? `${title.slice(0, 60)}...` : title;
}

export function getNotePreview(body) {
  const plain = getPlainNoteBody(body);

  if (!plain.trim()) return '';

  const lines = plain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const previewSource = lines.length > 1 ? lines.slice(1).join(' ') : lines[0];
  const clean = previewSource.replace(/\s+/g, ' ').trim();

  if (!clean) return '';

  return clean.length > 110 ? `${clean.slice(0, 110)}...` : clean;
}

export function formatNoteListDate(value) {
  if (!value) return '';

  const date = new Date(value);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (isYesterday) {
    return 'Gestern';
  }

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function formatEditorDate(value) {
  if (!value) return '';

  const date = new Date(value);

  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}