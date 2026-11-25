import { createInterface } from 'node:readline/promises';
import { ClientFactory } from '@a2a-js/sdk/client';
import { parseCliArgs, usage } from './args.ts';
import { renderCard } from './card.ts';
import { runCommand } from './commands.ts';
import { Conversation } from './conversation.ts';
import { UsageError } from './errors/usage-error.ts';
import { renderEvent } from './render.ts';
import { terminalStyle as style } from './style.ts';

function readOptions() {
  try {
    return parseCliArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`${style('red', error.message)}\n\n${usage}`);
      process.exit(2);
    }
    throw error;
  }
}

// Without a url, the agent this repository runs, on the PORT in .env, which must then be set: there is no fallback.
function defaultUrl(): string {
  const port = process.env.PORT;
  if (port === undefined || port === '') {
    throw new Error('PORT is not set: set it in .env (see .env.example), or pass the agent URL as the first argument');
  }
  return `http://localhost:${port}`;
}

const options = readOptions();
if (options.help) {
  console.log(usage);
  process.exit(0);
}

const client = await new ClientFactory().createFromUrl(options.url ?? defaultUrl(), options.cardPath);
const card = await client.getAgentCard();
console.log(`${renderCard(card, style)}\n`);
console.log(style('dim', 'Type a question, or /help for the commands.\n'));

const renderOptions = { style, verbose: options.verbose, now: () => new Date() };
const conversation = new Conversation();
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: style('cyan', `${card.name} > You: `) });
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
      const lines = renderEvent(response, renderOptions);
      if (lines !== undefined) {
        console.log(lines);
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
  const outcome = runCommand(text, {
    conversation,
    style,
    print: (lines) => {
      console.log(lines);
    }
  });
  if (outcome === 'exit') {
    break;
  }
  if (outcome === undefined && text !== '') {
    await ask(text);
  }
  if (!input.closed) {
    rl.prompt();
  }
}
rl.close();
