# Deploy do IOAuto em VPS com aaPanel

Este repositorio foi reorganizado para rodar o IOAuto em uma VPS propria com:

- `web` em Next.js
- `api` em Spring Boot
- `postgres` em container
- `redis` externo ou compartilhado da VPS
- Asaas para assinatura recorrente

## Arquivos principais

- `docker-compose.vps.yml`
- `docker-compose.deploy.yml`
- `.env.vps`
- `.env.vps.example`
- `apps/web/Dockerfile`
- `apps/api/Dockerfile`

## 1. Arquitetura recomendada

Use tres dominios:

- `ioauto.ioconnect.com.br` -> frontend publico
- `app.ioauto.ioconnect.com.br` -> frontend autenticado
- `api.ioauto.ioconnect.com.br` -> API

O aaPanel fica responsavel por:

- publicar os dominios
- fazer reverse proxy
- emitir SSL

## 2. Preparar a VPS

No aaPanel, confirme:

- plugin Docker instalado
- Website habilitado
- DNS apontando para a VPS

Clone o projeto em um caminho estavel:

```bash
mkdir -p /www/wwwroot
cd /www/wwwroot
git clone <URL_DO_REPOSITORIO> ioauto
cd ioauto
```

## 3. Criar o arquivo `.env`

```bash
cp .env.vps.example .env
```

Se quiser usar a configuracao pronta deste repositorio como base:

```bash
cp .env.vps .env
```

Ajuste pelo menos:

- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `IOAUTO_PLAN_VALUE`

Os segredos de JWT e criptografia podem ser mantidos conforme o `.env.vps` gerado.
Importante: `JWT_SECRET_FOR_MIDDLEWARE` precisa ser igual a `JWT_SECRET`.

## 3.1 Dados do app de deploy

- Docker Network: `ioauto_network`
- DB container name: `ioauto_postgres`
- API container name fixo: nao usar no modo blue/green
- Web container name fixo: nao usar no modo blue/green

## 3.2 Deploy Tool blue/green

Para a ferramenta de deploy, use:

- compose: `docker-compose.deploy.yml`
- env base: `.env.vps`
- registry URL: `ghcr.io`
- namespace: `sotorivaxl`
- DB host/container: `ioauto_postgres`
- docker network compartilhada: `ioauto_network`

Esse compose foi preparado para release imutavel:

- `api` e `web` usam `image` + `build`
- `api` e `web` nao usam `container_name` fixo
- `api` e `web` nao publicam portas fixas no host
- o banco continua externo ao ciclo blue/green

Variaveis importantes para o app:

- `REGISTRY_URL`
- `REGISTRY_NAMESPACE`
- `RELEASE_TAG`
- `DEPLOY_NETWORK_NAME`
- `DB_HOST`

As imagens geradas ficam nestes nomes:

- `${REGISTRY_URL}/${REGISTRY_NAMESPACE}/ioauto-api:${RELEASE_TAG}`
- `${REGISTRY_URL}/${REGISTRY_NAMESPACE}/ioauto-web:${RELEASE_TAG}`

## 4. Subir os containers

```bash
cp .env.vps .env
docker compose --env-file .env -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.vps.yml ps
docker compose -f docker-compose.vps.yml logs -f api
```

## 5. Criar os proxies no aaPanel

### Frontend

- dominio: `ioauto.ioconnect.com.br`
- destino: `http://127.0.0.1:3001`

### Frontend autenticado

- dominio: `app.ioauto.ioconnect.com.br`
- destino: `http://127.0.0.1:3001`

### API

- dominio: `api.ioauto.ioconnect.com.br`
- destino: `http://127.0.0.1:8081`
- habilite WebSocket para `/ws/realtime`

## 6. SSL

Emita os certificados Lets Encrypt para os tres dominios e force HTTPS.

Depois mantenha:

- `NEXT_PUBLIC_APP_URL=https://app.ioauto.ioconnect.com.br`
- `NEXT_PUBLIC_API_BASE=https://api.ioauto.ioconnect.com.br`
- `APP_PUBLIC_URL=https://app.ioauto.ioconnect.com.br`
- `API_INTERNAL_BASE=http://api:8080`
- `APP_CORS_ALLOWED_ORIGINS=https://ioauto.ioconnect.com.br,https://app.ioauto.ioconnect.com.br`
- `AUTH_COOKIE_SECURE=true`

## 7. Asaas webhook

Cadastre no Asaas um endpoint apontando para:

```text
https://api.ioauto.ioconnect.com.br/webhooks/asaas/billing
```

No webhook, configure o mesmo token em:

- `ASAAS_WEBHOOK_TOKEN`

Mantenha tambem:

- `ASAAS_API_KEY`
- `ASAAS_API_BASE_URL=https://api.asaas.com/v3`
- `ASAAS_CHECKOUT_BASE_URL=https://asaas.com`
- `IOAUTO_PLAN_VALUE`
- `ASAAS_BILLING_TYPES=CREDIT_CARD,BOLETO`

## 8. Smoke test

```bash
curl http://127.0.0.1:8081/health
curl -I http://127.0.0.1:3001/login
docker compose -f docker-compose.vps.yml logs --tail=100 web
docker compose -f docker-compose.vps.yml logs --tail=100 api
```

Valide no navegador:

1. acesse `/`
2. abra `/assinar`
3. teste o login
4. entre na area protegida
5. confira dashboard, estoque, integracoes e assinatura

## 9. Redis compartilhado

Se for usar o Redis do host:

- prefira `REDIS_DATABASE=1`
- nao use `FLUSHALL`
- confirme que os containers conseguem acessar o host

## 10. Atualizacao de versao

```bash
cd /www/wwwroot/ioauto
git pull
docker compose -f docker-compose.vps.yml up -d --build
```

## 11. Rotas publicas importantes

- landing: `/`
- checkout: `/assinar`
- sucesso: `/assinar/sucesso`
- webhook Asaas: `/webhooks/asaas/billing`

## 12. Integracoes operacionais

- WebMotors: a camada de tenant, credenciais e publicacoes ja esta pronta para receber a integracao oficial
