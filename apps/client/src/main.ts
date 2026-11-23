import { sendPrompt } from './a2a-request.ts';
import { agentsApi } from './agents-api.ts';
import { parseCommand } from './args.ts';

// The server's own PORT from the root .env; the client fails loudly without it, as the server does.
const port = process.env.PORT;
if (port === undefined || port === '') {
  throw new Error('PORT is not set: add it to the root .env (see .env.example)');
}

const api = agentsApi(`http://localhost:${port}`);
const command = parseCommand(process.argv.slice(2));

switch (command.name) {
  case 'ask': {
    const agent = await api.get(command.agentId);
    console.log(`Asking ${agent.name} (${agent.id}, ${agent.harness} harness)…`);
    const result = await sendPrompt(agent.cardUrl, command.prompt);
    console.log(`State: ${result.state}`);
    console.log(`Artifact:\n${result.artifactText}`);
    break;
  }
  case 'list-agents': {
    const page = await api.list();
    for (const agent of page.items) {
      console.log(`${agent.id}\t${agent.harness}\t${agent.name}`);
    }
    console.log(`${String(page.total)} agent(s)`);
    break;
  }
  case 'create-agent': {
    const agent = await api.create(command.agent);
    console.log(`Created ${agent.id} on the ${agent.harness} harness; its card: ${agent.cardUrl}`);
    break;
  }
}
