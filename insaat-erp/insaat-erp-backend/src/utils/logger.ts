const levels = { error: 0, warn: 1, http: 2, info: 3, debug: 4 } as const;
const min = (process.env.LOG_LEVEL || 'info').toLowerCase();
const minN = min in levels ? levels[min as keyof typeof levels] : levels.info;

function out(level: keyof typeof levels, args: unknown[]) {
  if (levels[level] > minN) return;
  const tag = new Date().toISOString();
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[${tag}] [${level.toUpperCase()}]`, ...args);
}

export default {
  error: (...a: unknown[]) => out('error', a),
  warn: (...a: unknown[]) => out('warn', a),
  http: (msg: string) => out('http', [msg]),
  info: (...a: unknown[]) => out('info', a),
  debug: (...a: unknown[]) => out('debug', a),
};
