# App de solicitações Eletro Ativa

Sistema para lojas/gerentes criarem solicitações e para o administrador acompanhar, responder e controlar prazos em um painel centralizado.

## Acesso inicial

```text
Usuário: admin
Senha local atual: Ativa-ad69ab77!
```

Em produção, defina a variável `ADMIN_PASSWORD` antes do primeiro acesso para escolher a senha definitiva.

O administrador acessa o painel completo, cria usuários das lojas, acompanha solicitações e registra respostas.

Os usuários das lojas acessam apenas o formulário de criação de solicitação. O nome e o setor da solicitação são preenchidos a partir da conta logada.

## Como usar

Rode o servidor na pasta do projeto:

```bash
node server.js
```

ou:

```bash
npm start
```

Depois acesse:

```text
http://127.0.0.1:4173/index.html
```

Os dados, usuários e solicitações ficam salvos no servidor em:

```text
data/app-data.json
```

Em produção, use a variável `DATA_DIR` apontando para uma pasta persistente da hospedagem.

Não abra o `index.html` direto no navegador para operação real. Use sempre o `server.js`, porque login, banco central e WhatsApp dependem dele.

## Acesso na rede local

O servidor escuta em `0.0.0.0:4173`. Em computadores/celulares na mesma rede, use o IP da máquina que está rodando o app:

```text
http://192.168.1.220:4173/index.html
```

Esse endereço só funciona dentro da mesma rede local. Para lojas em outras cidades, hospede o app em um servidor online.

## WhatsApp automático

Quando uma solicitação é criada, o servidor tenta avisar o administrador pelo WhatsApp.

Quando o administrador envia uma resposta, o servidor tenta avisar o solicitante pelo WhatsApp cadastrado no usuário da loja.

Para enviar de verdade pelo WhatsApp, configure estas variáveis de ambiente antes de iniciar o servidor:

```bash
WHATSAPP_ACCESS_TOKEN=token_da_meta \
WHATSAPP_PHONE_NUMBER_ID=id_do_numero_remetente \
WHATSAPP_TO=numero_do_admin_com_ddi \
node server.js
```

O arquivo local `whatsapp.env` pode ser usado para guardar essas variáveis no desenvolvimento.

O envio usa a WhatsApp Cloud API da Meta. Em produção, mensagens iniciadas pela empresa normalmente precisam de modelos aprovados pela Meta e de um número oficial brasileiro registrado.

## Acesso de outras cidades

O endereço `127.0.0.1` funciona apenas no computador onde o app está rodando. Um gerente em outra cidade não consegue acessar esse endereço.

Para acesso externo, será necessário hospedar o app em um servidor ou plataforma online. Esta versão já tem backend central por arquivo JSON, pronto para ser levado para hospedagem simples.

## Hospedagem definitiva

Para uma URL pública estável, hospede o projeto em uma plataforma Node.js, como Render, Railway, Fly.io ou um VPS.

Este projeto já inclui arquivos de produção:

```text
render.yaml
railway.json
Dockerfile
Procfile
.env.production.example
```

Variáveis obrigatórias em produção:

```text
NODE_ENV=production
ADMIN_PASSWORD=sua_senha_forte
DATA_DIR=pasta_persistente_da_hospedagem
```

Variáveis opcionais para WhatsApp:

```text
WHATSAPP_ACCESS_TOKEN=token_da_meta
WHATSAPP_PHONE_NUMBER_ID=id_do_numero
WHATSAPP_TO=5565992524994
WHATSAPP_API_VERSION=v23.0
```

No Render, use o arquivo `render.yaml`. Ele já configura o comando `node server.js`, rota de saúde `/api/health` e disco persistente em `/opt/render/project/src/storage`.

## O que já faz

- Login com perfil de administrador e perfil de loja/gerente.
- Cadastro de usuários das lojas com usuário, senha e WhatsApp.
- Cadastro de solicitações com gerente, setor, prioridade, prazo e descrição.
- Prazo de resposta automático por prioridade: Alta em 24 horas, Média em 3 dias e Baixa em 7 dias.
- Notificação ao administrador quando chega uma solicitação e notificação ao solicitante quando uma resposta é enviada.
- Lista com busca, filtro por status, filtro por prioridade e ordenação.
- Painel de detalhes com histórico.
- Marcação como em andamento.
- Resposta final e mudança automática para resolvida.
- Métricas de abertas, vencendo hoje, atrasadas e concluídas.
- Exportação em CSV.
- Dados centralizados no servidor, em vez de `localStorage`.
- Arquivos sensíveis protegidos contra acesso direto pelo navegador.

## Próximo passo natural

Para liberar para lojas de outras cidades, o próximo passo é hospedar este servidor em uma URL pública e configurar o número oficial do WhatsApp Business na Meta.
