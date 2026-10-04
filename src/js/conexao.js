const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const NodeCache = require('node-cache');
const readline = require('readline');
const { logger, installGlobalHandlers } = require('./logger.js');

chalk.level = 3;
installGlobalHandlers();

const ROOT = path.resolve(__dirname, '../..');
const SESSION_DIR = path.resolve(ROOT, 'dono/SpeedBot-Sessao');
const SPEED_FILE = path.resolve(ROOT, 'speed.js');
const SETTINGS_FILE = path.resolve(ROOT, 'dono/settings.js');
const BANNER_FILE = path.resolve(ROOT, 'src/logs/speedcloud.txt');
const RECONNECT_DELAY = 1800;
const FRESH_MESSAGE_TOLERANCE_SEC = 15;

const msgRetryCounterCache = new NodeCache({ stdTTL: 300, checkperiod: 120, useClones: false });

let reconnecting = false;
let starting = false;
let client = null;
let waVersion = null;
let speedModule = null;
let settings = {};
let speedVersion = 0;
let settingsVersion = 0;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const blue = text => chalk.hex('#3B82F6')(text);
const darkblue = text => chalk.hex('#00296C')(text);
const lightBlue = text => chalk.hex('#60A5FA')(text);
const white = text => chalk.white(text);

function logInfo(text) {
  console.log(lightBlue('│ ') + white(text));
  logger.info(text);
}

function logSuccess(text) {
  console.log(chalk.hex('#38BDF8')('│✓ ') + white(text));
  logger.info(text);
}

function logError(text, error = null) {
  console.log(chalk.hex('#1D4ED8')('│✗ ') + white(text));
  logger.error(text, error || '');
}

function logReload(text) {
  console.log(blue('│↻ ') + white(text));
  logger.reload(text);
}

function showBanner() {
  console.clear();

  try {
    const content = fs.readFileSync(BANNER_FILE, 'utf8').replace(/\r/g, '').trimEnd();
    const lines = content.split('\n');

    console.log('');
    for (const line of lines) console.log(chalk.bold.hex('#3B82F6')(line));

    console.log(lightBlue('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(darkblue(` [ ${settings.botName || 'Speed Bot'} ]• `) + blue('SpeedCloud') + white(' Hosting'));
    console.log(lightBlue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  } catch (error) {
    logger.warn('Falha ao ler banner', error);
    console.log(chalk.bold.hex('#3B82F6')('SPEEDCLOUD ') + chalk.bold.white('HOSTING'));
  }
}

function loadSettings(first = false) {
  try {
    delete require.cache[require.resolve(SETTINGS_FILE)];
    const next = require(SETTINGS_FILE);

    if (!next || typeof next !== 'object') throw new Error('settings.js precisa exportar um objeto.');

    settings = next;
    settingsVersion++;

    if (!first) logReload(`settings.js atualizado em memória • versão ${settingsVersion} • conexão mantida.`);
    return true;
  } catch (error) {
    logError('Falha ao carregar settings.js.', error);
    return false;
  }
}

function loadSpeed(first = false) {
  try {
    delete require.cache[require.resolve(SPEED_FILE)];
    const next = require(SPEED_FILE);

    if (typeof next.handleMessage !== 'function') throw new Error('speed.js precisa exportar handleMessage().');

    speedModule = next;
    speedVersion++;

    if (!first) logReload(`speed.js atualizado em memória • versão ${speedVersion} • conexão mantida.`);
    return true;
  } catch (error) {
    logError('Falha ao carregar speed.js. A versão anterior continuará ativa.', error);
    if (!speedModule) process.exitCode = 1;
    return false;
  }
}

function watchHotReload() {
  let speedTimer = null;
  let settingsTimer = null;

  fs.watchFile(SPEED_FILE, { interval: 350 }, (current, previous) => {
    if (current.mtimeMs === previous.mtimeMs) return;
    clearTimeout(speedTimer);
    speedTimer = setTimeout(() => loadSpeed(false), 120);
  });

  fs.watchFile(SETTINGS_FILE, { interval: 350 }, (current, previous) => {
    if (current.mtimeMs === previous.mtimeMs) return;
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => loadSettings(false), 120);
  });
}

async function getVersion() {
  if (waVersion) return waVersion;

  try {
    const latest = await fetchLatestBaileysVersion();
    waVersion = latest.version;
  } catch (error) {}

  return waVersion;
}

async function askPhone() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = text => new Promise(resolve => rl.question(text, resolve));

  console.log(white('Primeira conexão. Informe o número com DDI + DDD.'));
  const input = await question(blue('Número: '));
  rl.close();

  return String(input || '').replace(/\D/g, '');
}

async function startConnection() {
  if (starting) return client;
  starting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const version = await getVersion();

    client = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Chrome', 'Chrome', '120.0.0'],
      generateHighQualityLinkPreview: false,
      msgRetryCounterCache,
      connectTimeoutMs: 45000,
      defaultQueryTimeoutMs: 45000,
      keepAliveIntervalMs: 15000,
      markOnlineOnConnect: false
    });

    if (!state.creds.registered) {
      const phoneNumber = await askPhone();
      if (!phoneNumber || phoneNumber.length < 10) throw new Error('Número inválido. Inclua DDI e DDD.');

      let code = await client.requestPairingCode(phoneNumber);
      code = code?.match(/.{1,4}/g)?.join('-') || code;

      console.log(lightBlue('\n╭─ CÓDIGO DE PAREAMENTO'));
      console.log(chalk.bold.white(`│ ${code}`));
      console.log(lightBlue('╰─ WhatsApp > Aparelhos conectados > Conectar com número\n'));
    }

    client.ev.on('creds.update', saveCreds);

    const connectionStartedAt = Math.floor(Date.now() / 1000);
    const oldestAcceptedTimestamp = connectionStartedAt - FRESH_MESSAGE_TOLERANCE_SEC;

    client.ev.on('messages.upsert', packet => {
      const current = speedModule;
      if (!current || packet?.type !== 'notify') return;

      const messages = Array.isArray(packet?.messages) ? packet.messages : [];
      if (!messages.length) return;

      const freshMessages = messages.filter(message => {
        const raw = message?.messageTimestamp;
        let timestamp = 0;

        if (typeof raw === 'number') timestamp = raw;
        else if (typeof raw === 'bigint') timestamp = Number(raw);
        else if (raw && typeof raw.toNumber === 'function') timestamp = raw.toNumber();
        else if (raw && typeof raw.low === 'number') timestamp = raw.low;
        else timestamp = Number(raw || 0);

        if (!Number.isFinite(timestamp) || timestamp <= 0) return true;
        return timestamp >= oldestAcceptedTimestamp;
      });

      if (!freshMessages.length) return;

      void current.handleMessage({
        client,
        packet: { ...packet, messages: freshMessages },
        wait,
        settings
      }).catch(error => logError('Erro durante execução do speed.js.', error));
    });

    client.ev.on('connection.update', async update => {
      const { connection, lastDisconnect } = update;

      if (connection === 'connecting') {
        logInfo("Hospedagem: https://dash.speedhostingg.cloud");
        logInfo('Conectando ao WhatsApp...');
        return;
      }

      if (connection === 'open') {
        reconnecting = false;
        starting = false;
        logSuccess(`${settings.botName || 'Speed Bot'} conectado com sucesso.`);
        return;
      }

      if (connection !== 'close') return;
      starting = false;

      const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.data?.statusCode || lastDisconnect?.error?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        reconnecting = false;
        logError('Sessão desconectada pelo WhatsApp. Vincule novamente apenas se necessário.', lastDisconnect?.error);
        return;
      }

      if (reconnecting) return;
      reconnecting = true;

      logError(`Conexão encerrada${statusCode ? ` (${statusCode})` : ''}. Reconectando...`, lastDisconnect?.error);
      await wait(RECONNECT_DELAY);
      reconnecting = false;

      startConnection().catch(error => logError('Falha ao reconectar.', error));
    });

    return client;
  } catch (error) {
    starting = false;
    throw error;
  }
}

loadSettings(true);
showBanner();
loadSpeed(true);
watchHotReload();

startConnection().catch(error => {
  logError('Falha fatal ao iniciar conexão.', error);
  process.exitCode = 1;
});

function shutdown() {
  fs.unwatchFile(SPEED_FILE);
  fs.unwatchFile(SETTINGS_FILE);

  try {
    client?.end?.();
  } catch (error) {
    logger.warn('Erro ao encerrar socket', error);
  }

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
