import type { AppContext } from './models/app-context.model.ts';

declare global {
  namespace Express {
    interface Locals {
      context: AppContext;
    }
  }
}
