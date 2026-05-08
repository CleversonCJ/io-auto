# IOAuto

IOAuto e uma plataforma SaaS multi-tenant para operacoes automotivas, com foco em captacao de leads, gestao comercial, estoque de veiculos, publicacao em marketplaces e assinatura recorrente.

Hoje o projeto entrega uma base completa para:

- landing page publica de vendas no dominio principal
- cadastro rapido de lead comercial
- checkout recorrente com Asaas
- provisionamento automatico da conta apos pagamento
- autenticacao e area protegida por tenant
- dashboard operacional da loja
- gestao de conversas e leads
- cadastro e gestao de estoque de veiculos
- central de integracoes
- fila e acompanhamento de publicacoes
- estrutura preparada para WebMotors e proximos marketplaces

Nao faz parte do escopo atual:

- integracao com Z-API
- automacoes baseadas nesse canal
- billing com Stripe

## Stack

- `apps/web`: Next.js 15 + React 19 + TypeScript
- `apps/api`: Spring Boot 4 + Java 25
- PostgreSQL 16
- Redis 7

## Estrutura

```text
apps/
|-- api/
|   |-- src/main/java/com/io/appioweb/
|   |   |-- adapters/persistence/ioauto
|   |   |-- adapters/web/ioauto
|   |   |-- adapters/web/atendimentos
|   |   |-- application/auth
|   |   `-- config
|   `-- src/main/resources/db/migration
`-- web/
    |-- src/app
    |-- src/core
    `-- src/modules/ioauto
```

## Funcionalidades

### Landing e conversao

- pagina publica em `/` com estrutura comercial completa
- pagina de assinatura em `/assinar`
- cadastro rapido com:
  - nome completo
  - nome da empresa
  - e-mail
  - telefone
- redirecionamento para checkout hospedado do Asaas
- pagina de sucesso em `/assinar/sucesso`
- pagina de cancelamento em `/assinar/cancelado`

### Billing e onboarding

- criacao de `signup_intent` no backend
- criacao de checkout recorrente no Asaas
- webhook para confirmacao de pagamento
- consulta de status do signup
- ativacao automatica do tenant apos pagamento aprovado
- criacao automatica de:
  - empresa
  - equipe inicial
  - usuario administrador
  - integracoes padrao
- exibicao de senha provisoria na tela de sucesso para primeiro acesso

### Area protegida

- `/protected/dashboard`
- `/protected/conversas`
- `/protected/estoque`
- `/protected/publicacoes`
- `/protected/integracoes`
- `/protected/assinatura`
- `/protected/perfil`

### Operacao IOAuto

- dashboard com indicadores da operacao
- acompanhamento de leads e conversas
- origem da conversa visivel no inbox
- cadastro unificado de veiculos
- controle de publicacoes por integracao
- visao de status de assinatura
- abertura da cobranca mais recente no Asaas pela area logada

## Backend

Pontos principais do backend:

- `adapters/web/ioauto`
  expone endpoints de dashboard, estoque, integracoes, publicacoes, signup e billing
- `IoAutoBillingService`
  concentra o fluxo de checkout Asaas, status, webhook e provisionamento da conta
- `AsaasWebhookController`
  recebe os eventos de cobranca do Asaas
- `IoAutoPublicSignupController`
  recebe o cadastro rapido publico e inicia o checkout

Migracoes relevantes:

- `V29__ioauto_core.sql`
  cria tabelas de billing, signup, integracoes, veiculos e publicacoes
- `V30__atendimento_conversation_source_platform.sql`
  adiciona `source_platform` e `source_reference` em conversas

## Fluxo de assinatura

O fluxo atual funciona assim:

1. o visitante acessa a landing page
2. clica em um CTA e vai para `/assinar`
3. preenche o cadastro rapido
4. o backend cria o `signup_intent`
5. o checkout recorrente do Asaas e aberto
6. quando o pagamento e confirmado, o tenant e provisionado
7. o usuario volta para a tela de sucesso
8. o sistema exibe o e-mail de acesso e a senha provisoria

## Variaveis principais

### Billing Asaas

- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `ASAAS_API_BASE_URL`
- `ASAAS_CHECKOUT_BASE_URL`
- `ASAAS_BILLING_TYPES`
- `IOAUTO_PLAN_KEY`
- `IOAUTO_PLAN_NAME`
- `IOAUTO_PLAN_DESCRIPTION`
- `IOAUTO_PLAN_VALUE`
- `IOAUTO_PLAN_CYCLE`

### Aplicacao

- `APP_PUBLIC_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_BASE`
- `API_INTERNAL_BASE`
- `APP_CORS_ALLOWED_ORIGINS`
- `JWT_SECRET`
- `JWT_SECRET_FOR_MIDDLEWARE`
- `APP_DB_ENCRYPTION_KEY`

## Desenvolvimento local

Suba a infraestrutura:

```bash
docker compose -f dev-infra/docker-compose.yml up -d
```

Backend:

```bash
cd apps/api
./mvnw spring-boot:run
```

Frontend:

```bash
cd apps/web
npm install
npm run dev
```

## Build

Frontend:

```bash
cd apps/web
npm run build
```

Backend:

```bash
cd apps/api
./mvnw -DskipTests compile
```

## Deploy

Arquivos principais:

- `.env.vps.example`
- `docker-compose.vps.yml`
- `docker-compose.deploy.yml`
- `DEPLOY_AAPANEL.md`

O deploy atual considera:

- `postgres`
- `api`
- `web`

Redis pode continuar compartilhado na VPS.

## Integracoes

### Disponivel hoje

- WebMotors
  ja existe estrutura de configuracao e publicacao por tenant

### Preparado para evolucao

- novos marketplaces automotivos
- expansao da camada de publicacao e sincronizacao sem mudar a base do produto

## Observacoes

- o dominio principal foi preparado para operar como landing page comercial
- o fluxo de pagamento atual usa Asaas, nao Stripe
- a documentacao de deploy do projeto ja foi ajustada para esse modelo

---

## Onboarding API (Pos-Pagamento com Asaas)

### Visao geral

O modulo de onboarding permite que a Landing Page (ou um servico intermediario) chame o backend principal para:

1. Cadastrar empresa e primeiro usuario (INACTIVE)
2. Ativar empresa/usuario apos confirmacao de pagamento
3. Enviar e-mail de acesso ao primeiro usuario

Todos os endpoints sao idempotentes e protegidos com token interno.

### Variaveis de ambiente

```properties
# Token interno para comunicacao LP → Backend
ONBOARDING_INTERNAL_API_TOKEN=token_seguro_para_lp_chamar_backend

# Asaas API
ASAAS_BASE_URL=https://api-sandbox.asaas.com
ASAAS_ACCESS_TOKEN=token_asaas

# Em producao:
# ASAAS_BASE_URL=https://api.asaas.com

# URLs da aplicacao
APP_PUBLIC_URL=https://app.ioauto.com.br
LOGIN_URL=https://app.ioauto.com.br/login
SET_PASSWORD_URL=https://app.ioauto.com.br/definir-senha
```

### Endpoints

#### Fluxo com 3 endpoints separados

##### 1. POST /v1/onboarding/first-user/register

Cria empresa e usuario como INACTIVE. Nao ativa, nao envia e-mail.

```bash
curl -X POST https://api.ioauto.com.br/v1/onboarding/first-user/register \
  -H "Authorization: Bearer $ONBOARDING_INTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "evt_xxx:PAYMENT_CONFIRMED:register",
    "firstUserRegistration": {
      "razaoSocial": "Empresa X",
      "nomeFantasia": "Empresa X",
      "companyEmail": "contato@empresa.com",
      "cnpj": "12345678000199",
      "whatsappNumber": "47999999999",
      "endereco": "Rua X, 123, Centro",
      "cidade": "Blumenau",
      "uf": "SC",
      "cep": "89000000",
      "responsavelNome": "Joao Silva",
      "responsavelEmail": "joao@empresa.com",
      "responsavelWhatsapp": "47999999999",
      "status": "INACTIVE"
    },
    "comercial": {
      "valorPagoCliente": 197,
      "recorrenciaPagamento": "mensal",
      "dataAssinatura": "2026-05-08",
      "origem": "meta-campanha-maio"
    },
    "billing": {
      "paymentId": "pay_xxx",
      "subscriptionId": "sub_xxx",
      "planName": "IO Connect - Plano Mensal"
    }
  }'
```

##### 2. POST /v1/onboarding/first-user/activate

Ativa empresa, usuario e assinatura. So aceita status CONFIRMED, RECEIVED, PAYMENT_CONFIRMED ou PAYMENT_RECEIVED.

```bash
curl -X POST https://api.ioauto.com.br/v1/onboarding/first-user/activate \
  -H "Authorization: Bearer $ONBOARDING_INTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "evt_xxx:PAYMENT_CONFIRMED:activate",
    "paymentId": "pay_xxx",
    "subscriptionId": "sub_xxx",
    "paymentStatus": "PAYMENT_CONFIRMED",
    "valorPagoCliente": 197,
    "recorrenciaPagamento": "mensal",
    "dataAssinatura": "2026-05-08",
    "origem": "meta-campanha-maio",
    "planName": "IO Connect - Plano Mensal"
  }'
```

##### 3. POST /v1/onboarding/first-user/send-access-email

Envia e-mail de acesso. So envia se empresa e usuario estiverem ACTIVE.

```bash
curl -X POST https://api.ioauto.com.br/v1/onboarding/first-user/send-access-email \
  -H "Authorization: Bearer $ONBOARDING_INTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "evt_xxx:PAYMENT_CONFIRMED:email",
    "userId": "usr_123",
    "companyId": "cmp_123",
    "email": "joao@empresa.com",
    "nome": "Joao Silva",
    "loginUrl": "https://app.ioauto.com.br/login"
  }'
```

#### Fluxo simplificado (1 chamada)

##### POST /v1/onboarding/asaas/payment-event

Recebe um evento normalizado e executa register → activate → send-access-email internamente.

```bash
curl -X POST https://api.ioauto.com.br/v1/onboarding/asaas/payment-event \
  -H "Authorization: Bearer $ONBOARDING_INTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "evt_xxx:PAYMENT_CONFIRMED",
    "eventType": "PAYMENT_CONFIRMED",
    "paymentStatus": "PAYMENT_CONFIRMED",
    "customer": {
      "razaoSocial": "Empresa X",
      "nomeFantasia": "Empresa X",
      "companyEmail": "contato@empresa.com",
      "cnpj": "12345678000199",
      "whatsappNumber": "47999999999",
      "endereco": "Rua X, 123, Centro",
      "cidade": "Blumenau",
      "uf": "SC",
      "cep": "89000000",
      "responsavelNome": "Joao Silva",
      "responsavelEmail": "joao@empresa.com",
      "responsavelWhatsapp": "47999999999"
    },
    "billing": {
      "paymentId": "pay_xxx",
      "subscriptionId": "sub_xxx",
      "valorPagoCliente": 197,
      "recorrenciaPagamento": "mensal",
      "dataAssinatura": "2026-05-08",
      "origem": "meta-campanha-maio",
      "planName": "IO Connect - Plano Mensal"
    }
  }'
```

### Exemplo fetch/axios da LP

```javascript
// Exemplo com fetch (Node.js / LP)
const BACKEND_URL = process.env.BACKEND_URL;
const INTERNAL_TOKEN = process.env.ONBOARDING_INTERNAL_API_TOKEN;

// Fluxo simplificado
const response = await fetch(`${BACKEND_URL}/v1/onboarding/asaas/payment-event`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${INTERNAL_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    idempotencyKey: `${paymentId}:${eventType}`,
    eventType: 'PAYMENT_CONFIRMED',
    paymentStatus: 'PAYMENT_CONFIRMED',
    customer: { /* ... dados do cliente ... */ },
    billing: { /* ... dados do pagamento ... */ }
  })
});

const result = await response.json();
console.log('Onboarding result:', result);
```

```javascript
// Exemplo com axios
const axios = require('axios');

await axios.post(`${BACKEND_URL}/v1/onboarding/asaas/payment-event`, payload, {
  headers: {
    'Authorization': `Bearer ${INTERNAL_TOKEN}`,
    'Content-Type': 'application/json'
  }
});
```

### Regras importantes

- **register** sempre cria empresa e usuario como INACTIVE
- **activate** so roda com pagamento confirmado/recebido (CONFIRMED, RECEIVED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED)
- **send-access-email** so envia se usuario e empresa estiverem ACTIVE
- O Asaas pode reenviar eventos (webhooks duplicados) – a idempotencia e obrigatoria
- A descricao da assinatura no painel do Asaas deve ser atualizada via `PUT /v3/subscriptions/{id}`, pois a descricao do item do checkout nao garante o preenchimento da descricao da assinatura
- Toda chamada exige `idempotencyKey` unico
- Chamadas duplicadas retornam 200 sem efeitos colaterais
- Falha no envio de e-mail nao desfaz a ativacao
- Falha na sincronizacao da descricao no Asaas nao desfaz a ativacao

### Tabelas criadas (migration V47)

- `onboarding_events` – auditoria de eventos recebidos
- `onboarding_subscriptions` – assinaturas vinculadas ao onboarding
- `email_outbox` – fila de e-mails com idempotencia
- `password_reset_tokens` – tokens para definicao de senha
- Colunas adicionais em `companies`: razao_social, nome_fantasia, endereco, cidade, uf, cep, status, updated_at
- Colunas adicionais em `users`: nome, whatsapp, is_primary, updated_at
