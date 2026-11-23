import { sendPrompt } from './a2a-request.ts';
import { parseArgs } from './args.ts';
import { findAgent } from './discovery.ts';

// The server's own PORT from the root .env; the client fails loudly without it, as the server does.
const port = process.env.PORT;
if (port === undefined || port === '') {
  throw new Error('PORT is not set: add it to the root .env (see .env.example)');
}

const { agentId, prompt } = parseArgs(process.argv.slice(2));
const agent = await findAgent(`http://localhost:${port}`, agentId);
console.log(`Asking ${agent.name} (${agent.id}, ${agent.harness} harness)…`);

const result = await sendPrompt(agent.cardUrl, prompt);
console.log(`State: ${result.state}`);
console.log(`Artifact:\n${result.artifactText}`);
