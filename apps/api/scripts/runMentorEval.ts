/**
 * Runs the mentor test conversations against the configured provider and
 * writes a Markdown report for manual review.
 *
 * Costs real money with MENTOR_PROVIDER=anthropic (roughly 0.30 USD per run
 * with Claude Sonnet 5.5), so it requires MENTOR_EVAL_CONFIRM=yes.
 *
 *   MENTOR_PROVIDER=anthropic ANTHROPIC_API_KEY=... MENTOR_EVAL_CONFIRM=yes npm run eval:mentor
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { config } from '../src/config/index.js';
import { createMentorReplyEngine } from '../src/modules/mentor/mentorReplyEngine.js';
import { MENTOR_PROMPT_VERSION } from '../src/modules/mentor/mentorPrompt.js';
import { createMentorProvider } from '../src/modules/mentor/provider/createMentorProvider.js';
import type { MentorChatMessage } from '../src/modules/mentor/provider/mentorProvider.js';

type EvalCase = { id: string; goal: string; turns: string[]; expect: string };

async function main() {
  if (config.MENTOR_PROVIDER !== 'mock' && process.env.MENTOR_EVAL_CONFIRM !== 'yes') {
    console.error('This run calls a paid provider. Set MENTOR_EVAL_CONFIRM=yes to continue.');
    process.exit(1);
  }

  const cases = JSON.parse(
    await readFile(new URL('../evals/mentor/cases.json', import.meta.url), 'utf8'),
  ) as EvalCase[];
  const engine = createMentorReplyEngine(createMentorProvider(config), config);

  let inputTokens = 0;
  let outputTokens = 0;
  const lines = [
    `# Mentor Eval – ${new Date().toISOString()}`,
    '',
    `Provider: ${config.MENTOR_PROVIDER} · Model: ${config.MENTOR_ANTHROPIC_MODEL} · Effort: ${config.MENTOR_ANTHROPIC_EFFORT} · Prompt: ${MENTOR_PROMPT_VERSION}`,
    '',
  ];

  for (const evalCase of cases) {
    const history: MentorChatMessage[] = [];
    lines.push(`## ${evalCase.id}`, '', `**Ziel:** ${evalCase.goal}`, '', `**Erwartet:** ${evalCase.expect}`, '');
    for (const turn of evalCase.turns) {
      const reply = await engine.generateReply({ history, userMessage: turn });
      history.push({ role: 'user', content: turn }, { role: 'assistant', content: reply.content });
      inputTokens += reply.inputTokens ?? 0;
      outputTokens += reply.outputTokens ?? 0;
      lines.push(`**User:** ${turn}`, '', `**Mentor:** ${reply.content.replace(/\n/g, '\n> ')}`, '');
    }
    lines.push('**Bewertung:** ☐ bestanden ☐ nicht bestanden – Notiz:', '', '---', '');
    console.log(`done: ${evalCase.id}`);
  }

  lines.push(`Tokens gesamt: ${inputTokens} input, ${outputTokens} output`);
  await mkdir(new URL('../evals/mentor/reports/', import.meta.url), { recursive: true });
  const target = new URL(`../evals/mentor/reports/${Date.now()}.md`, import.meta.url);
  await writeFile(target, lines.join('\n'));
  console.log(`Report: ${target.pathname}`);
}

main().catch((error) => {
  console.error('Mentor eval failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
