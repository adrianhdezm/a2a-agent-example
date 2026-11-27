import { z } from 'zod';
import type { TurnEvent, TurnOutcome } from '../models/turn.model.ts';

// How every turn must end, on every runner: whether the question is answered, and the text the user reads.
export const answerSchema = z.strictObject({
  outcome: z
    .enum(['completed', 'input-required'])
    .describe('completed when you have answered the question; input-required when you need the user to tell you more first'),
  text: z.string().describe('Your answer, or your question to the user, written for the user to read')
}) satisfies z.ZodType<{ outcome: TurnOutcome; text: string }>;

/** Why a turn fails when its answer is not in the format. */
export const malformedAnswer = 'the answer did not match its output format';

/**
 * The answer format as JSON Schema draft 7, the draft the Claude Code CLI reads (it rejects zod's default, 2020-12),
 * with every property required and no others, as the OpenAI API's strict mode wants.
 */
export function answerJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(answerSchema, { target: 'draft-7' });
}

/** The turn's end, from whatever the SDK handed back as the answer. */
export function readAnswer(value: unknown): TurnEvent {
  const answer = answerSchema.safeParse(value);
  return answer.success ? { type: 'result', ok: true, ...answer.data } : { type: 'result', ok: false, error: malformedAnswer };
}

/** The turn's end, from an answer the SDK handed back as JSON text. */
export function readAnswerText(text: string | undefined): TurnEvent {
  try {
    return readAnswer(JSON.parse(text ?? ''));
  } catch {
    return { type: 'result', ok: false, error: malformedAnswer };
  }
}

/** A tool call as progress, worded the same on every runner. */
export function toolCallProgress(name: string, input: unknown): TurnEvent {
  return { type: 'progress', text: `Calling ${name} ${JSON.stringify(input)}` };
}
