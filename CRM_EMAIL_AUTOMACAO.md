# Automacao de orcamentos por e-mail para o CRM

## Dados do app

URL do CRM:

```text
https://eletro-ativa-app.onrender.com/api/email/crm
```

Header obrigatorio:

```text
x-email-crm-secret: COLE_A_CHAVE_DO_RENDER_AQUI
```

A chave precisa ser a mesma variavel salva no Render:

```text
EMAIL_CRM_WEBHOOK_SECRET
```

## Modelo recomendado no Make

1. Crie um Scenario.
2. Modulo 1: Gmail > Watch emails.
3. Escolha o e-mail exclusivo de orcamentos.
4. Se quiser filtrar, use assunto ou label com "orcamento".
5. Modulo 2: HTTP > Make a request.
6. Method: POST.
7. URL: `https://eletro-ativa-app.onrender.com/api/email/crm`.
8. Headers:

```text
x-email-crm-secret: COLE_A_CHAVE_DO_RENDER_AQUI
Content-Type: application/json
```

9. Body type: Raw.
10. Content type: JSON.
11. Body:

```json
{
  "messageId": "{{Message ID}}",
  "subject": "{{Subject}}",
  "from": "{{From}}",
  "replyTo": "{{Reply-To}}",
  "text": "{{Text content}}",
  "html": "{{HTML content}}",
  "unit": "CORP"
}
```

## Modelo recomendado no Zapier

1. Crie um Zap.
2. Trigger: Gmail > New Email ou New Email Matching Search.
3. Conecte o e-mail exclusivo de orcamentos.
4. Action: Webhooks by Zapier > Custom Request.
5. Method: POST.
6. URL: `https://eletro-ativa-app.onrender.com/api/email/crm`.
7. Data Pass-Through: No.
8. Headers:

```text
x-email-crm-secret: COLE_A_CHAVE_DO_RENDER_AQUI
Content-Type: application/json
```

9. Data:

```json
{
  "messageId": "{{Message Id}}",
  "subject": "{{Subject}}",
  "from": "{{From Email}}",
  "replyTo": "{{Reply To}}",
  "text": "{{Body Plain}}",
  "html": "{{Body HTML}}",
  "unit": "CORP"
}
```

## Como o CRM interpreta

- `subject` vira o titulo da oportunidade.
- `from` vira cliente/contato/e-mail.
- `text` ou `html` vira observacao.
- Se encontrar telefone no texto, salva no WhatsApp.
- Se encontrar valor como `R$ 1.234,56`, salva como valor do orcamento.
- `messageId` evita duplicar o mesmo e-mail.
- `unit` pode ser `SPZ`, `CNP` ou `CORP`.

## Teste rapido

Envie um e-mail para a caixa exclusiva com:

```text
Assunto: Orcamento Cliente Teste R$ 2.450,00
Corpo: Cliente pediu quadro eletrico. WhatsApp 65 99999-0000.
```

Depois verifique a aba CRM Vendas no app.
