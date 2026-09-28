export type LogContext = Record<string, string | number | boolean | null | undefined>;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';

const minimumLevel = LEVEL_PRIORITY[configuredLevel] ?? LEVEL_PRIORITY.info;

function formatContext(context?: LogContext) {
  if (!context) return '';

  const fields = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`);

  return fields.length > 0 ? ` ${fields.join(' ')}` : '';
}

function write(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
) {
  if (LEVEL_PRIORITY[level] < minimumLevel) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const details = formatContext(context);

  if (error instanceof Error) {
    const errorDetails =
      process.env.NODE_ENV === 'production'
        ? error.message
        : error.stack ?? error.message;

    console.error(`${prefix} ${message}${details} error="${errorDetails}"`);
    return;
  }

  if (level === 'error') {
    console.error(`${prefix} ${message}${details}`);
    return;
  }

  if (level === 'warn') {
    console.warn(`${prefix} ${message}${details}`);
    return;
  }

  if (level === 'debug') {
    console.debug(`${prefix} ${message}${details}`);
    return;
  }

  console.log(`${prefix} ${message}${details}`);
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    write('debug', message, context),

  info: (message: string, context?: LogContext) =>
    write('info', message, context),

  warn: (message: string, context?: LogContext) =>
    write('warn', message, context),

  error: (
    message: string,
    error?: unknown,
    context?: LogContext
  ) => write('error', message, context, error),
};
