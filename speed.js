const { getContentType } = require('baileys');
const fs = require('fs');
const chalk = require('chalk');
const { logger } = require('./src/js/logger.js');

const MENU_IMAGE = './src/image/menu.png';
let menuBuffer = null;

try {
menuBuffer = fs.readFileSync(MENU_IMAGE);
} catch (error) {
logger.warn('Não foi possível pré-carregar a imagem do menu.', error);
}

function unwrapMessage(message = {}) {
let current = message;
for (let i = 0; i < 4; i++) {
const type = getContentType(current);
if (type === 'ephemeralMessage' || type === 'viewOnceMessage' || type === 'viewOnceMessageV2' || type === 'viewOnceMessageV2Extension') {
current = current?.[type]?.message || current;
continue;
}
break;
}
return current;
}

function extractMessageBody(info) {
const message = unwrapMessage(info?.message || {});
const type = getContentType(message);
if (!type) return '';

try {
switch (type) {
case 'conversation': return message.conversation || '';
case 'extendedTextMessage': return message.extendedTextMessage?.text || '';
case 'imageMessage': return message.imageMessage?.caption || '';
case 'videoMessage': return message.videoMessage?.caption || '';
case 'documentMessage': return message.documentMessage?.caption || '';
case 'documentWithCaptionMessage': return message.documentWithCaptionMessage?.message?.documentMessage?.caption || '';
case 'buttonsResponseMessage': return message.buttonsResponseMessage?.selectedButtonId || message.buttonsResponseMessage?.selectedDisplayText || '';
case 'listResponseMessage': return message.listResponseMessage?.singleSelectReply?.selectedRowId || message.listResponseMessage?.title || '';
case 'templateButtonReplyMessage': return message.templateButtonReplyMessage?.selectedId || message.templateButtonReplyMessage?.selectedDisplayText || '';
case 'interactiveResponseMessage': {
const params = message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
if (!params) return '';
const parsed = JSON.parse(params);
return parsed?.id || parsed?.selectedId || parsed?.row_id || parsed?.display_text || '';
}
default: return '';
}
} catch (error) {
logger.warn('Falha ao extrair conteúdo da mensagem.', error);
return '';
}
}

function messageInfo(info, body = '') {
const message = unwrapMessage(info?.message || {});
const type = getContentType(message) || 'unknown';
const data = message?.[type] || {};
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const cut = value => {
const text = clean(value);
return text.length > 90 ? `${text.slice(0, 87)}...` : text;
};

const types = {
conversation: ['TEXTO', '💬'], extendedTextMessage: ['TEXTO', '💬'],
imageMessage: ['IMAGEM', '🖼️'], videoMessage: ['VÍDEO', '🎬'], audioMessage: ['ÁUDIO', '🎵'],
stickerMessage: ['STICKER', '🏷️'], documentMessage: ['DOCUMENTO', '📄'], documentWithCaptionMessage: ['DOCUMENTO', '📄'],
buttonsResponseMessage: ['BOTÃO', '🔘'], templateButtonReplyMessage: ['BOTÃO', '🔘'], interactiveResponseMessage: ['BOTÃO', '🔘'],
listResponseMessage: ['LISTA', '📋'], reactionMessage: ['REAÇÃO', '✨'], contactMessage: ['CONTATO', '👤'], contactsArrayMessage: ['CONTATOS', '👥'],
locationMessage: ['LOCALIZAÇÃO', '📍'], liveLocationMessage: ['LOCALIZAÇÃO', '📍'], pollCreationMessage: ['ENQUETE', '📊'], pollUpdateMessage: ['VOTO', '🗳️']
};
const [label, icon] = types[type] || [type.replace(/Message$/i, '').toUpperCase(), '📨'];

let preview = cut(body);
if (!preview) {
if (type === 'audioMessage') preview = data?.ptt ? 'Mensagem de voz' : 'Arquivo de áudio';
else if (type === 'stickerMessage') preview = data?.isAnimated ? 'Sticker animado' : 'Sticker';
else if (type === 'documentMessage') preview = cut(data?.fileName || data?.title || data?.mimetype);
else if (type === 'reactionMessage') preview = cut(data?.text || 'Reação removida');
else if (type === 'contactMessage') preview = cut(data?.displayName || 'Contato');
else if (type === 'locationMessage' || type === 'liveLocationMessage') preview = cut(data?.name || data?.address || 'Localização compartilhada');
else if (type === 'imageMessage' || type === 'videoMessage') preview = cut(data?.caption) || 'Sem legenda';
else preview = 'Sem texto';
}

return { type, label, icon, preview };
}

function logIncoming(info, body) {
const pushname = info?.pushName || 'Usuário';
const from = info?.key?.remoteJid || 'desconhecido';
const group = from.endsWith('@g.us');
const media = messageInfo(info, body);
const scope = group ? 'GRUPO' : 'PRIVADO';

console.log(
chalk.hex('#2563EB')('╭─ RECEBIDA ') +
chalk.hex('#60A5FA')(`[${media.icon} ${media.label}]`) +
chalk.gray(` [${scope}]`)
);
console.log(chalk.hex('#3B82F6')('│ ') + chalk.white(pushname) + chalk.gray(` • ${from}`));
console.log(chalk.hex('#3B82F6')('╰─ ') + chalk.white(media.preview));
}

async function processMessage(client, info, wait, settings) {
if (!info?.message || info.key?.remoteJid === 'status@broadcast') return;

const { prefix = '+', verMsg = true } = settings || {};
const from = info.key.remoteJid;
const body = extractMessageBody(info).trim();

logIncoming(info, body);

if (verMsg) void client.readMessages([info.key]).catch(error => logger.warn('Falha ao marcar mensagem como lida.', error));

const isCmd = Boolean(prefix) && body.startsWith(prefix);
if (!isCmd) return;

const commandText = body.slice(prefix.length).trim();
const parts = commandText.split(/\s+/).filter(Boolean);
const comando = (parts.shift() || '').toLowerCase();
const args = parts;
const q = args.join(' ');

if (!comando) return;

const sendText = (text, options = {}) => client.sendMessage(from, { text: String(text), ...options }, { quoted: info });
const sendImage = (source, caption = '') => {
let image;
if (Buffer.isBuffer(source)) image = source;
else if (typeof source === 'string' && /^https?:\/\//i.test(source)) image = { url: source };
else image = fs.readFileSync(source);
return client.sendMessage(from, { image, ...(caption ? { caption } : {}) }, { quoted: info });
};
const sendVideo = (source, caption = '') => client.sendMessage(from, { video: { url: source }, mimetype: 'video/mp4', ...(caption ? { caption } : {}) }, { quoted: info });
const sendGif = (source, caption = '') => client.sendMessage(from, { video: { url: source }, gifPlayback: true, ...(caption ? { caption } : {}) }, { quoted: info });
const sendAudio = (source, ptt = false) => client.sendMessage(from, { audio: { url: source }, mimetype: 'audio/mpeg', ptt }, { quoted: info });
const react = emoji => client.sendMessage(from, { react: { text: emoji, key: info.key } });
const typingReply = async (text, delayMs = 0) => {
void client.sendPresenceUpdate('composing', from).catch(() => null);
if (delayMs > 0) await wait(delayMs);
const result = await sendText(text);
void client.sendPresenceUpdate('paused', from).catch(() => null);
return result;
};

switch (comando) {
// ───────────── COMANDOS ─────────────
case 'menu': {
void react('☁').catch(() => null);
const textoMenu = `╭━━━〔 ☁ SPEED CLOUD 〕━━┈╮
┃「 INFO 」
┃› Bot: _SpeedBot_ *_Base_*
┃› User: *${info?.pushName}*
┃┉━━━━━━━━━━━━━━━┉ׅ
┃「 COMANDOS 」
┃› ${prefix}menu
┃› ${prefix}ping
╰━━━━━━━━━━━━━━━━┈╯
> *_Speed Cloud Hosting_*`;
await sendImage(menuBuffer || MENU_IMAGE, textoMenu);
}
break;

case 'ping': {
const started = process.hrtime.bigint();
const sent = await sendText('🏓 Pong!');
const ms = Number(process.hrtime.bigint() - started) / 1e6;
await sendText(`> *${ms.toFixed(1)}ms*`);
}
break;
// ─────────────────────────────────────

default: {
void react('❌').catch(() => null);
await sendText(`Comando não encontrado. Use ${prefix}menu para ver os exemplos disponíveis.`);
break;
}
}

void q; void sendVideo; void sendGif; void sendAudio; void typingReply;
}

async function handleMessage({ client, packet, wait, settings }) {
if (packet?.type !== 'notify') return;
const messages = Array.isArray(packet?.messages) ? packet.messages : [];

await Promise.allSettled(messages.map(info => processMessage(client, info, wait, settings)));
}

module.exports = { handleMessage };
