#!/data/data/com.termux/files/usr/bin/bash

while true; do
  clear
  printf '\033[1;34m[SPEEDCLOUD]\033[0m Iniciando bot...\n'
  node src/js/start.js
  EXIT_CODE=$?

  printf '\n\033[1;34m[SPEEDCLOUD]\033[0m Processo encerrado com código %s. Reiniciando em 2 segundos...\n' "$EXIT_CODE"
  sleep 2
done
