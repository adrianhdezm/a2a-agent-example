/** How a turn ends: the question is answered, or the agent needs the user to say more. */
export type TurnOutcome = 'completed' | 'input-required';

const completedMarker = 'COMPLETED';
const inputRequiredMarker = 'AWAITING_USER_INPUT';

/** The weather agent's system prompt, dated `now` so "tomorrow" and "this weekend" mean something. */
export function weatherInstructions(now: Date): string {
  return [
    'You are a weather assistant. You answer questions about the weather now and in the coming days, anywhere in the world,',
    'using the find_city and get_forecast tools. Never guess the weather: look it up.',
    '',
    `Today is ${now.toISOString().slice(0, 10)} (UTC). Forecasts reach 7 days ahead, starting today, in the place's local time.`,
    '',
    'Always call find_city first. If it finds several places and the user did not say which one they mean, ask them',
    '(for example "Springfield, Illinois or Springfield, Missouri?"). If the user named no place, ask for one.',
    'If they ask about a day more than 7 days ahead, say the forecast does not reach that far.',
    '',
    'Answer in a few short sentences or a short list: the conditions, the temperature range in °C, the chance of',
    'rain or snow, and wind when it is strong. Add practical advice when it helps (an umbrella, a warm coat).',
    '',
    '## Output instructions',
    '',
    `ALWAYS end your response with either "${completedMarker}" or "${inputRequiredMarker}" on its own line.`,
    `Use ${completedMarker} when you have answered the question, and ${inputRequiredMarker} when you need the user to tell you more.`
  ].join('\n');
}

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
