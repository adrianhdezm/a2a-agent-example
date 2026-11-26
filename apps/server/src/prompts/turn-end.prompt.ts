/** The marker on an answer's last line that says the question is answered. */
export const completedMarker = 'COMPLETED';

/** The marker on an answer's last line that says the agent needs the user to tell it more. */
export const inputRequiredMarker = 'AWAITING_USER_INPUT';

/**
 * The lines any agent's system prompt ends with to run on the `TurnAgentExecutor`: they ask for the marker the
 * executor reads off the answer's last line.
 */
export const turnEndInstructions = [
  '## Output instructions',
  '',
  `ALWAYS end your response with either "${completedMarker}" or "${inputRequiredMarker}" on its own line.`,
  `Use ${completedMarker} when you have answered the question, and ${inputRequiredMarker} when you need the user to tell you more.`
].join('\n');
