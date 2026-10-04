<div align="center">
  <img src="src/image/menu.png" alt="SpeedBot" width="720">

  <h1>SpeedBot</h1>
  <p><strong>Base de bot para WhatsApp da SpeedCloud Hosting.</strong></p>
  <p>Simples de editar, rápida para testar e pronta para crescer sem transformar o projeto numa bagunça.</p>

  <p>
    <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white">
    <img alt="Baileys" src="https://img.shields.io/badge/Baileys-7.x-25D366?style=for-the-badge&logo=whatsapp&logoColor=white">
    <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-CommonJS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111">
  </p>

  <p>
    <a href="#-instalação">Instalação</a> •
    <a href="#-configuração">Configuração</a> •
    <a href="#-criando-comandos">Comandos</a> •
    <a href="#-estrutura">Estrutura</a> •
    <a href="#-logs">Logs</a>
  </p>
</div>

---

## ☁️ Sobre o projeto

O **SpeedBot** é uma base em Node.js usando Baileys para conexão com o WhatsApp. A estrutura foi feita para facilitar a criação de comandos e evitar trabalho desnecessário durante o desenvolvimento.

O bot já vem com:

- conexão persistente com o WhatsApp;
- pareamento por número;
- hot reload de comandos e configurações;
- filtro para ignorar mensagens antigas depois de uma reconexão;
- identificação de texto, imagem, vídeo, áudio, sticker, documento, botões e outros tipos de mensagem;
- logs organizados no terminal e em arquivos;
- comandos `menu` e `ping` como exemplos;
- imagem do menu carregada em memória para evitar leitura repetida do arquivo.

## 🚀 Instalação

### Requisitos

- **Node.js 20+**
- **npm**
- uma conta do WhatsApp com suporte a aparelhos conectados

Clone ou extraia o projeto, entre na pasta e instale as dependências:

```bash
npm install
npm start
```

Na primeira execução, digite o número com **DDI + DDD + número**. O terminal exibirá o código de pareamento.

No WhatsApp, abra:

> **Aparelhos conectados → Conectar um aparelho → Conectar com número**

A sessão fica em `dono/SpeedBot-Sessao/`. Se apagar essa pasta, será necessário parear o WhatsApp novamente.

## ⚙️ Configuração

As configurações principais ficam em `dono/settings.js`:

```js
const prefix = '+';
const botName = 'Speed Bot';
const donoJids = ['5561999999999'];
const donoLids = ['LID'];
const verMsg = true;

module.exports = { prefix, botName, donoJids, donoLids, verMsg };
```

| Opção | Função |
| --- | --- |
| `prefix` | Prefixo usado nos comandos, como `+menu` |
| `botName` | Nome do bot usado pelo projeto |
| `verMsg` | Marca mensagens recebidas como lidas |
| `donoJids` | Lista de JIDs autorizados como dono |
| `donoLids` | Lista de LIDs autorizados como dono |

O `settings.js` possui hot reload. Dá para alterar essas opções sem derrubar a conexão atual.

## 🧩 Criando comandos

Os comandos ficam no `switch (comando)` de `speed.js`.

### Comando simples

```js
case 'oi': {
  await sendText('Olá! 👋');
  break;
}
```

Com o prefixo padrão:

```text
+oi
```

### Recebendo argumentos

Tudo depois do nome do comando fica disponível em `q`:

```js
case 'falar': {
  if (!q) return sendText(`Use: ${prefix}falar seu texto`);

  await sendText(q);
  break;
}
```

Uso:

```text
+falar SpeedCloud é foda
```

### Apelidos para o mesmo comando

```js
case 'ajuda':
case 'help':
case 'comandos': {
  await sendText('Lista de comandos...');
  break;
}
```

## 🛠️ Funções disponíveis

Dentro dos comandos você pode usar diretamente:

```js
await sendText('texto');
await sendImage('./imagem.png', 'legenda');
await sendVideo('https://exemplo.com/video.mp4', 'legenda');
await sendGif('https://exemplo.com/gif.mp4', 'legenda');
await sendAudio('https://exemplo.com/audio.mp3');
await react('✅');
await typingReply('Resposta');
```

Também ficam disponíveis `client`, `info`, `from`, `body`, `comando`, `args`, `q`, `settings` e `prefix`.

Respostas de botões e listas que possuem um ID de comando entram no mesmo parser. Um botão com ID `+menu`, por exemplo, executa o mesmo código de alguém digitando `+menu`.

## 📁 Estrutura

```text
SpeedBot/
├── dono/
│   └── settings.js
├── src/
│   ├── image/
│   │   └── menu.png
│   ├── js/
│   │   ├── conexao.js
│   │   ├── logger.js
│   │   └── start.js
│   └── logs/
├── speed.js
├── package.json
├── README.md
└── start.sh
```

### Arquivos principais

| Arquivo | Responsabilidade |
| --- | --- |
| `speed.js` | Leitura da mensagem, parser e comandos |
| `src/js/conexao.js` | Conexão com o WhatsApp e eventos do Baileys |
| `src/js/start.js` | Inicialização e reinício do processo quando necessário |
| `src/js/logger.js` | Escrita e organização dos logs |
| `dono/settings.js` | Configurações editáveis do bot |

## ♻️ Hot reload

O projeto trata cada alteração de acordo com o que realmente precisa ser reiniciado:

| Alteração | Comportamento |
| --- | --- |
| `speed.js` | Recarrega os comandos sem derrubar a conexão |
| `dono/settings.js` | Atualiza as configurações sem derrubar a conexão |
| `src/js/conexao.js` | Reinicia a conexão pelo supervisor |

Isso deixa a criação e o teste de comandos bem mais rápidos.

## 🧾 Logs

Mensagens recebidas aparecem no terminal com tipo, origem, usuário e uma prévia:

```text
╭─ RECEBIDA [💬 TEXTO] [PRIVADO]
│ Pedro • 5561...@s.whatsapp.net
╰─ +menu
```

Os registros persistentes ficam em `src/logs/`:

```text
errors.txt
info.txt
reload.txt
runtime.txt
speedcloud.txt
warnings.txt
```

## 🧪 Verificação rápida

Antes de iniciar o bot, você pode validar a sintaxe dos arquivos principais:

```bash
npm run check
```

Se o comando terminar sem erro, a verificação de sintaxe passou.

## 💬 Comandos incluídos

| Comando | Descrição |
| --- | --- |
| `+menu` | Exibe o menu principal |
| `+ping` | Testa resposta e latência do bot |

## ⚡ Desempenho

O recebimento das mensagens não fica esperando tarefas secundárias como confirmação de leitura e reações. Mensagens recebidas no mesmo pacote também podem ser processadas em paralelo.

Para comandos pesados — download grande, conversão de vídeo ou API lenta — vale manter o processamento isolado no próprio comando para não segurar o restante do bot.

---

<div align="center">
  <strong>SpeedBot • SpeedCloud Hosting</strong><br>
  <sub>Base feita para editar, testar e colocar pra rodar.</sub>
</div>
