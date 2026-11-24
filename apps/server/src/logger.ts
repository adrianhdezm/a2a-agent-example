import { pino } from 'pino';

/** Plain JSON logs; `pnpm dev` pipes them through pino-pretty. */
export const logger = pino({ level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug') });
