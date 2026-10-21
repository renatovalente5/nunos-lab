# Nuno's Lab

Vantagens em estabelecimentos parceiros para os clientes da barbearia
**Nuno's Lab** (Nogueira do Cravo, Santa Maria da Feira, Aveiro).

- **App do cliente** — <https://renatovalente5.github.io/nunos-lab/>: as vantagens
  de cada parceiro e as marcações nas lojas. Expo (web agora; iPhone e Android
  depois, do mesmo código).
- **Backoffice do Nuno** — <https://renatovalente5.github.io/nunos-lab/backoffice/>:
  parceiros, promoções, categorias, lojas, o aviso da app, acessos, números e registo.
- **API** — Cloudflare Worker `nunos-lab` + D1 `nunos-lab` (jurisdição UE).

## Como está arrumado

```
apps/cliente/      a app (Expo Router; web estática no GitHub Pages)
apps/backoffice/   o backoffice (Vite + React, sem servidor próprio)
apps/api/          o Worker (Hono): /api/app, imagens, contagens, /api/bo/*
packages/dominio/  as regras escritas uma vez (datas de Lisboa, estados, limites, tipos)
base/migracoes/    o esquema do D1; base/exemplos.sql, os dados da demonstração
marca/originais/   os logótipos oficiais, tirados de nunoslab.com
scripts/           acesso.mjs (1.ª ligação), provar-api.mjs, publicar.mjs
```

## Comandos

```bash
npm run tudo                                   # formato, tipos e testes
npm run dev -w @nunos-lab/api                  # API em http://localhost:8870
npm run dev -w @nunos-lab/backoffice           # backoffice em http://localhost:8871
npm run web -w @nunos-lab/cliente              # app em http://localhost:8872
node scripts/provar-api.mjs                    # a prova da API, contra o servidor local
node scripts/acesso.mjs --nome "Nome" --remoto # a 1.ª ligação de acesso (produção)
npm run publicar -w @nunos-lab/api             # publicar a API
node scripts/publicar.mjs                      # publicar a app e o backoffice
```

## Decisões

- **Entrar no backoffice é abrir uma ligação de acesso**: vale uma vez e 7 dias, e
  troca-se por uma sessão do aparelho (90 dias sem uso). Sem palavras-passe nem email.
  As ligações seguintes criam-se no próprio backoffice, em «Acessos».
- **A app não pede dados nem usa cookies.** Conta aberturas, visitas e toques, por
  dia e sem pessoa.
- **Um parceiro só aparece na app com uma promoção ligada e dentro das datas.** As
  datas são dias de Lisboa, o início e o fim inteiros.
- **Os parceiros de exemplo** têm `exemplo = 1`, levam a etiqueta «Exemplo» na app e
  apagam-se num botão do backoffice.
- **Por fazer**: a prova de que o cliente cortou o cabelo (o QR que muda no balcão),
  os cupões sorteados a cada corte, a Wallet, e as apps nas lojas.
