import { styleText } from 'node:util';

export type StyleFormat = 'bold' | 'dim' | 'cyan' | 'green' | 'yellow' | 'red' | 'magenta' | 'blue';

/** How the CLI styles text: colours in a terminal, nothing in tests or when output is piped. */
export type Style = (format: StyleFormat, text: string) => string;

/** `node:util`'s `styleText`, which leaves text plain when stdout is not a terminal or `NO_COLOR` is set. */
export const terminalStyle: Style = (format, text) => styleText(format, text);

/** No styling at all. */
export const plainStyle: Style = (_format, text) => text;
