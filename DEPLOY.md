# Publicar o app com URL definitiva

O app precisa rodar em uma hospedagem Node.js para as lojas acessarem de qualquer cidade.

## Opção rápida: Render

1. Entre em https://render.com.
2. Crie um novo Web Service a partir deste projeto.
3. Use o arquivo `render.yaml` quando a plataforma pedir a configuração.
4. Configure estas variáveis:

```text
ADMIN_PASSWORD=escolha_uma_senha_forte
WHATSAPP_ACCESS_TOKEN=token_da_meta
WHATSAPP_PHONE_NUMBER_ID=id_do_numero_da_meta
WHATSAPP_TO=5565992524994
WHATSAPP_API_VERSION=v23.0
```

O `render.yaml` já configura:

```text
startCommand: node server.js
healthCheckPath: /api/health
DATA_DIR=/opt/render/project/src/storage
disco persistente de 1 GB
```

## Opção com servidor VPS

1. Envie esta pasta para o servidor.
2. Crie um arquivo `.env` baseado em `.env.production.example`.
3. Rode:

```bash
NODE_ENV=production DATA_DIR=/app/data ADMIN_PASSWORD=sua_senha_forte node server.js
```

4. Coloque Nginx/Caddy apontando seu domínio para a porta do app.

## Importante

- Nao publique `whatsapp.env`.
- Nao publique a pasta `data/` local se ela tiver dados de teste.
- Use HTTPS na URL definitiva.
- O WhatsApp da Meta em produção ainda depende de número oficial aprovado e templates quando necessário.
