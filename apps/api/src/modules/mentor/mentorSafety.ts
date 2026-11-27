/**
 * Deterministic safety net that does not depend on the LLM.
 *
 * It is deliberately conservative: a false positive only adds help resources
 * to a reply, a false negative is still covered by the system prompt.
 */
const CRISIS_PATTERNS: RegExp[] = [
  /\bsuizid/i,
  /\bselbstmord/i,
  /\bumbringen\b/i,
  /\bnicht\s+mehr\s+leben\b/i,
  /\bwill\s+sterben\b/i,
  /\bmich\s+(selbst\s+)?(ritzen|verletzen)\b/i,
  /\bselbstverletz/i,
  /\bkeinen\s+sinn\s+mehr\b/i,
  /\bsuicid/i,
  /\bkill\s+myself\b/i,
  /\bend\s+my\s+life\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bself[-\s]?harm/i,
];

export const CRISIS_RESOURCES_NOTE = [
  'Wenn es dir gerade nicht gut geht: Du bist nicht allein.',
  'Die Telefonseelsorge ist kostenlos und rund um die Uhr erreichbar: 0800 111 0 111 oder 0800 111 0 222.',
  'In akuter Gefahr wähle bitte sofort den Notruf 112.',
].join(' ');

export function detectCrisisSignal(text: string): boolean {
  const normalized = text.normalize('NFKC');
  return CRISIS_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function ensureCrisisResources(reply: string): string {
  if (reply.includes('0800 111 0 111')) {
    return reply;
  }
  return `${reply.trim()}\n\n${CRISIS_RESOURCES_NOTE}`;
}
