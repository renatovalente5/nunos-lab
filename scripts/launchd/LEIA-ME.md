# Cópia de segurança semanal da base (D1 «nunos-lab»)

`scripts/copia-de-seguranca.sh` exporta a base de produção para `docs/copias/nunos-lab-AAAA-MM-DD.sql`
(fora do git) e guarda o ponto do Time Travel em `ponto-AAAA-MM-DD.txt`. Ficam as últimas oito.

Para correr sozinha aos domingos às 04:00 (se o Mac estiver a dormir, corre quando acordar), instala-se
uma vez no launchd do Renato:

```bash
cp scripts/launchd/pt.nunoslab.copia-de-seguranca.plist ~/Library/LaunchAgents/ && launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/pt.nunoslab.copia-de-seguranca.plist
```

Para correr já: `launchctl kickstart gui/$(id -u)/pt.nunoslab.copia-de-seguranca` (ou o script à mão).
Para tirar: `launchctl bootout gui/$(id -u)/pt.nunoslab.copia-de-seguranca`.

Antes de uma operação destrutiva na base (apagar exemplos, migrar à mão), correr o script à mão: o
`ponto-….txt` guarda o «bookmark» para `wrangler d1 time-travel restore nunos-lab --bookmark=…`.
