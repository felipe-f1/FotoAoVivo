# Mural de Fotos — Aniversário

App para os convidados escanearem um QR Code, tirarem/enviarem uma foto pelo celular e verem ela aparecer ao vivo no telão do salão. No fim do evento, todas as fotos ficam salvas num álbum para a aniversariante rever.

## Páginas

- `/` — painel com atalhos para as telas abaixo.
- `/upload` — página que abre ao escanear o QR Code (câmera do celular).
- `/telao` — tela para deixar aberta em tela cheia no computador ligado à TV/projetor. Atualiza sozinha a cada poucos segundos.
- `/album` — galeria com todas as fotos, para rever depois do evento.
- `/qr` — gera o QR Code que aponta para `/upload` (tem um botão de imprimir).

## Como funciona o armazenamento

O celular do convidado sobe a foto **direto para o Vercel Blob** (upload client-side, via `@vercel/blob/client`). O servidor só emite um token de autorização de curta duração (`app/api/upload/route.ts`) — ele nunca recebe o arquivo em si, o que evita o limite de ~4.5MB de corpo de requisição das funções serverless da Vercel (uma foto de câmera de celular passa disso fácil).

Por isso é necessário ter um **Vercel Blob Store** conectado ao projeto (variável `BLOB_READ_WRITE_TOKEN`) mesmo para rodar localmente.

## Rodando localmente

```bash
npm install
vercel link        # conecta esta pasta ao projeto já criado na Vercel
vercel env pull .env.local   # baixa o BLOB_READ_WRITE_TOKEN real
npm run dev
```

Abra `http://localhost:3000`.

## Colocando no ar (Vercel)

1. Suba este projeto para um repositório no GitHub.
2. Importe o repositório em https://vercel.com/new.
3. No projeto criado na Vercel, vá em **Storage → Create Database → Blob** e conecte ao projeto (isso cria a variável `BLOB_READ_WRITE_TOKEN` automaticamente).
4. (Opcional) em **Settings → Environment Variables**, adicione `NEXT_PUBLIC_EVENT_NAME` com o nome do evento (ex: "Aniversário da Maria — 15 anos").
5. Faça o deploy. A URL gerada pela Vercel é a que vai no QR Code — abra `/qr` nela para gerar e imprimir.

## No dia do evento

1. Abra `/telao` em tela cheia no computador ligado ao projetor/TV.
2. Imprima ou exiba o QR Code de `/qr` nas mesas/entrada.
3. Os convidados escaneiam, tiram a foto e enviam — ela aparece no telão automaticamente.
4. Depois do evento, envie o link de `/album` para a aniversariante.
