const fs = require('fs');
const path = require('path');
const util = require('util');

const LOG_DIR = path.resolve(__dirname, '../logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const stamp = () => new Date().toISOString();

function format(value) {
  if (value instanceof Error) return value.stack || value.message || String(value);
  if (typeof value === 'string') return value;
  return util.inspect(value, { depth: 6, colors: false, breakLength: 120 });
}

function write(type, ...values) {
  try {
    const line = `[${stamp()}] [${type.toUpperCase()}] ${values.map(format).join(' ')}\n`;
    fs.appendFileSync(path.join(LOG_DIR, `${type}.txt`), line);
    fs.appendFileSync(path.join(LOG_DIR, 'runtime.txt'), line);
  } catch {}
}

const logger = {
  info: (...values) => write('info', ...values),
  warn: (...values) => write('warnings', ...values),
  error: (...values) => write('errors', ...values),
  reload: (...values) => write('reload', ...values)
};

let installed = false;

function installGlobalHandlers() {
  if (installed) return;
  installed = true;

  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.warn = (...values) => {
    logger.warn(...values);
    originalWarn(...values);
  };

  console.error = (...values) => {
    logger.error(...values);
    originalError(...values);
  };

  process.on('warning', warning => logger.warn(warning));
  process.on('uncaughtException', error => {
    logger.error('uncaughtException', error);
    originalError(error);
  });

  process.on('unhandledRejection', reason => {
    logger.error('unhandledRejection', reason);
    originalError(reason);
  });

  process.on('multipleResolves', (type, promise, value) => {
    logger.warn('multipleResolves', type, value);
    void promise;
  });
}

module.exports = { logger, installGlobalHandlers, LOG_DIR };
