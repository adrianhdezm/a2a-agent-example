import type { Conversation } from './conversation.ts';
import type { Style } from './style.ts';

/** What a command needs from the session it runs in. */
export interface CommandContext {
  conversation: Conversation;
  style: Style;
  print: (text: string) => void;
}

/** Whether the session goes on after a command. */
export type CommandOutcome = 'continue' | 'exit';

interface Command {
  description: string;
  run: (context: CommandContext) => CommandOutcome;
}

const commands: Record<string, Command> = {
  '/new': {
    description: 'start a new conversation',
    run: ({ conversation, style, print }) => {
      conversation.reset();
      print(style('dim', 'Started a new conversation.'));
      return 'continue';
    }
  },
  '/help': {
    description: 'list the commands',
    run: ({ style, print }) => {
      print(
        Object.entries(commands)
          .map(([name, { description }]) => `  ${style('bold', name.padEnd(6))} ${description}`)
          .join('\n')
      );
      print(style('dim', '  Ctrl+C cancels the answer in progress, or quits when there is none.'));
      return 'continue';
    }
  },
  '/exit': { description: 'quit', run: () => 'exit' }
};

/**
 * Runs the line as a command when it starts with `/`; an unknown command is reported, not sent to the agent. Answers
 * undefined for a line that is not a command, which is a message for the agent.
 */
export function runCommand(line: string, context: CommandContext): CommandOutcome | undefined {
  if (!line.startsWith('/')) {
    return undefined;
  }
  const command = commands[line.split(/\s+/)[0] ?? ''];
  if (command === undefined) {
    context.print(context.style('yellow', `Unknown command ${line}: /help lists the commands.`));
    return 'continue';
  }
  return command.run(context);
}
