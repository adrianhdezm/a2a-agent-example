import { createInterface } from 'node:readline/promises';
import { styleText } from 'node:util';
import { ClientFactory } from '@a2a-js/sdk/client';
import { requireVariable } from '@a2a-agent-example/shared';
import { Conversation } from './conversation.ts';
import { renderEvent } from './render.ts';
import type { Style } from './render.ts';

// The agent's URL is the first argument; without one, the server this repository runs, on the PORT in .env.
const agentUrl = process.argv[2] ?? `http://localhost:${requireVariable(process.env, 'PORT')}`;
const style: Style = (format, text) => styleText(format, text);

const client = await new ClientFactory().createFromUrl(agentUrl);
const card = await client.getAgentCard();
console.log(`${style('green', card.name)}: ${card.description}`);
for (const example of card.skills.flatMap((skill) => skill.examples)) {
  console.log(style('dim', `  e.g. ${example}`));
}
console.log(style('dim', 'Type a question. /new starts a new conversation, /exit quits, Ctrl+C cancels a running answer.\n'));

const conversation = new Conversation();
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: style('cyan', 'You: ') });
let answering = false;
// Piped input closes the interface once it is read, possibly while an answer still streams.
const input = { closed: false };
rl.on('close', () => {
  input.closed = true;
});

// Ctrl+C cancels the answer in progress; with none in progress, it quits.
rl.on('SIGINT', () => {
  const taskId = conversation.taskId;
  if (!answering || taskId === undefined) {
    rl.close();
    return;
  }
  client.cancelTask({ tenant: '', id: taskId, metadata: undefined }).catch((error: unknown) => {
    console.error(style('red', `Could not cancel: ${error instanceof Error ? error.message : String(error)}`));
  });
});

async function ask(text: string): Promise<void> {
  answering = true;
  try {
    for await (const response of client.sendMessageStream(conversation.request(text))) {
      conversation.observe(response);
      const line = renderEvent(response, style);
      if (line !== undefined) {
        console.log(line);
      }
    }
  } catch (error) {
    console.error(style('red', `Request failed: ${error instanceof Error ? error.message : String(error)}`));
  } finally {
    answering = false;
  }
}

rl.prompt();
for await (const line of rl) {
  const text = line.trim();
  if (text === '/exit' || text === '/quit') {
    break;
  }
  if (text === '/new') {
    conversation.reset();
    console.log(style('dim', 'Started a new conversation.'));
  } else if (text !== '') {
    await ask(text);
  }
  if (!input.closed) {
    rl.prompt();
  }
}
rl.close();
