const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { logger, installGlobalHandlers } = require('./logger.js');

chalk.level = 3;
installGlobalHandlers();

const ROOT = path.resolve(__dirname, '../..');
const CONNECTION_FILE = path.resolve(__dirname, 'conexao.js');

let child = null;
let restarting = false;
let stopping = false;
let restartTimer = null;

function log(text) {
  console.log(chalk.hex('#3B82F6')('↻ ') + chalk.white(text));
  logger.reload(text);
}

function startBot() {
  if (stopping) return;
  restarting = false;

  child = spawn(process.execPath, [CONNECTION_FILE], {
    cwd: ROOT,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '3' }
  });

  child.stdout.on('data', chunk => process.stdout.write(chunk));
  child.stderr.on('data', chunk => {
    process.stderr.write(chunk);
    logger.error('conexao.js stderr', chunk.toString().trimEnd());
  });

  child.on('error', error => {
    logger.error('Falha ao iniciar conexao.js', error);
    console.error(error);
  });

  child.on('exit', (code, signal) => {
    child = null;
    if (stopping) return;

    if (restarting) {
      setTimeout(startBot, 250);
      return;
    }

    logger.warn(`conexao.js encerrou inesperadamente. code=${code} signal=${signal || 'nenhum'}`);
    console.log(chalk.hex('#2563EB')('✗ ') + chalk.white(`Bot encerrou${code !== null ? ` com código ${code}` : ''}. Reiniciando...`));
    setTimeout(startBot, 1500);
  });
}

function restartBot(reason) {
  if (stopping) return;
  clearTimeout(restartTimer);

  restartTimer = setTimeout(() => {
    logger.reload(reason);
    log(reason);
    restarting = true;

    if (child) child.kill('SIGTERM');
    else startBot();
  }, 180);
}

fs.watchFile(CONNECTION_FILE, { interval: 350 }, (current, previous) => {
  if (current.mtimeMs === previous.mtimeMs) return;
  restartBot('conexao.js alterado • reiniciando o bot inteiro.');
});

function shutdown() {
  stopping = true;
  fs.unwatchFile(CONNECTION_FILE);
  clearTimeout(restartTimer);
  if (child) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 200);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
startBot();
