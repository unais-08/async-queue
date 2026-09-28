import { JobHandler } from '../domain/job';

/** Application handlers are registered at worker startup, outside queue storage. */
const handlers = new Map<string, JobHandler<any>>();

export function register(type: string, handler: JobHandler<any>) {
  if (!type.trim()) throw new Error('Job type cannot be empty');
  if (handlers.has(type)) throw new Error(`Handler already registered for ${type}`);
  handlers.set(type, handler);
}

export function getHandler(type: string) {
  return handlers.get(type);
}
