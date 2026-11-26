/** How a turn ends: the question is answered, or the agent needs the user to say more. */
export type TurnOutcome = 'completed' | 'input-required';

const completedMarker = 'COMPLETED';
const inputRequiredMarker = 'AWAITING_USER_INPUT';

/**
 * The lines any agent's system prompt ends with to run on the `TurnAgentExecutor`: they ask for the marker that
 * `readTurnEnd` reads.
 */
export const turnEndInstructions = [
  '## Output instructions',
  '',
  `ALWAYS end your response with either "${completedMarker}" or "${inputRequiredMarker}" on its own line.`,
  `Use ${completedMarker} when you have answered the question, and ${inputRequiredMarker} when you need the user to tell you more.`
].join('\n');

/**
 * Splits an answer into its text and how the turn ended, read from the marker on its last line. An answer without a
 * marker counts as completed, so a model that forgets it still delivers its answer.
 */
export function readTurnEnd(answer: string): { outcome: TurnOutcome; text: string } {
  const lines = answer.trimEnd().split('\n');
  const last = lines.at(-1)?.trim().toUpperCase();
  if (last === completedMarker || last === inputRequiredMarker) {
    return { outcome: last === completedMarker ? 'completed' : 'input-required', text: lines.slice(0, -1).join('\n').trim() };
  }
  return { outcome: 'completed', text: answer.trim() };
}
