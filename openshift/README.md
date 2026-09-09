# Guia de Implantação no Red Hat OpenShift / Kubernetes
### Plataforma Integrada de Gestão Operacional & Inteligência Analítica (EMBASA / UMB)

Este diretório contém os manifestos oficiais de infraestrutura para implantação conteinerizada do ecossistema no cluster **Red Hat OpenShift (OCP)** da EMBASA.

---

## 🏗️ 1. Arquitetura de Contêineres no Cluster

O ecossistema é desacoplado em 3 microsserviços integrados através de Service Discovery interno:

| Serviço | Porta Interna | Imagem / Contexto | Descrição |
| :--- | :--- | :--- | :--- |
| **`gestao-service`** | `3001` | `1 - gestoaumb/Dockerfile` | Servidor Express + Frontend React/Vite compilado (`dist/`). Atua como Gateway Web. |
| **`saneaia-service`** | `8000` | `3 - Saneaia/Dockerfile` | API REST FastAPI de predições, Machine Learning (Random Forest) e NLP. |
| **`webhook-service`** | `3002` | `2 - extracao_pendencias/Dockerfile` | Receptor HTTP de dados brutos das views da Embasa com Carga Dupla. |

---

## 🚀 2. Como Implantar no OpenShift (Passo a Passo)

### Pré-requisito
Estar autenticado no cluster OpenShift via CLI (`oc login`) e posicionado no namespace/projeto de destino (ex: `embasa-umb`):
```bash
oc project embasa-umb
```

### Passo 1: Construir as Imagens no Registro Interno do OpenShift
```bash
# Build do Painel de Gestão (Node.js + React)
oc new-build --name gestao-app --binary --strategy docker
oc start-build gestao-app --from-dir="./1 - gestoaumb" --follow

# Build do SaneaIA (FastAPI + ML)
oc new-build --name saneaia-app --binary --strategy docker
oc start-build saneaia-app --from-dir="./3 - Saneaia" --follow

# Build do Webhook Ingestion (Python)
oc new-build --name webhook-app --binary --strategy docker
oc start-build webhook-app --from-dir="./2 - extracao_pendencias" --follow
```

### Passo 2: Aplicar os Manifestos de Implantação
Na raiz do projeto, execute o comando unificado:
```bash
oc apply -f openshift/
```

O OpenShift criará automaticamente:
1. `painel-umb-storage`: PersistentVolumeClaim de 10Gi (RWX) montado em `/app/data` para persistência dos bancos SQLite.
2. `painel-umb-config`: ConfigMap com as variáveis de roteamento e caminhos dos bancos.
3. `gestao-deployment` e `gestao-service`: Pod do painel gerencial.
4. `saneaia-deployment` e `saneaia-service`: Pod do motor de IA.
5. `webhook-deployment` e `webhook-service`: Pod do receptor de dados.
6. `painel-umb-route` e `saneaia-route`: Rotas oficiais com terminação TLS/HTTPS para acesso na Intranet.

---

## 🔗 3. Arquitetura de Comunicação e Portas no OpenShift

Diferente do ambiente local onde usamos portas diretas (`:8080`, `:3001`, `:8000`, `:3002`), no cluster OpenShift **todas as portas são internas e protegidas**:

```
[ Usuários na Intranet ]
         │  (HTTPS porta 443)
         ▼
[ OpenShift Router ]
   │                 │
   │ (painel-umb-route) (saneaia-route)
   ▼                 ▼
[ gestao-service ] [ saneaia-service ]
  (Porta 3001)       (Porta 8000)
       │                 ▲
       │ (proxy interno) │
       └─────────────────┘
```

1. **Painel de Gestão (Projeto 1):**
   - Acesso externo via rota: `https://painel-umb-<namespace>.apps.ocp.embasa.ba.gov.br`
   - O usuário no navegador faz requisições para `/api/...` e `/api/saneaia/...`.
   - O backend Express atua como **Proxy Reverso transparente**: requisições de IA são repassadas internamente via DNS do cluster para `http://saneaia-service:8000`. O usuário não precisa saber da existência da porta 8000.

2. **SaneaIA Analytics / Chat IA (Projeto 3):**
   - Acesso externo direto via rota: `https://saneaia-<namespace>.apps.ocp.embasa.ba.gov.br`
   - Permite aos gestores e à equipe técnica acessar o dashboard analítico dedicado, o Chat IA corporativo e a documentação interativa Swagger (`/docs`).

3. **Compartilhamento de Dados e Persistência:**
   - O Persistent Volume Claim (`painel-umb-storage`, 10Gi RWX) é montado na pasta `/app/data` em todos os contêineres.
   - Os bancos SQLite residem nessa pasta compartilhada:
     - `/app/data/database.sqlite` (Gestão UMB)
     - `/app/data/saneaia.db` (SaneaIA Inteligência)
   - Qualquer atualização feita pelo Webhook ou pelos dashboards é persistida imediatamente e permanece disponível mesmo após restarts dos pods.

---

## 📡 4. Ingestão Automática de Dados via Webhook

O contêiner `webhook-service` roda ininterruptamente (24/7), sem depender de terminais ou máquinas locais de operadores:

* **Disparo Interno no Cluster (Recomendado para rotinas da TI / CronJobs):**
  - URL: `http://webhook-service:3002/webhook`
  - Método: `POST`
  - Não requer autenticação externa por estar isolado na rede interna do Kubernetes.

* **Disparo Externo / Sistemas Fora do Cluster:**
  - URL: `https://painel-umb-<namespace>.apps.ocp.embasa.ba.gov.br/webhook`
  - Método: `POST`
  - Passa pelo proxy reverso do Express e é repassado automaticamente para o `webhook-service`.

### Fluxo Automático de Processamento:
1. O Webhook recebe o JSON ou CSV da view da Embasa.
2. Realiza a **Carga Dupla**:
   - Grava os registros brutos em `/app/data/saneaia.db` (Projeto 3).
   - Envia o lote classificado para `http://gestao-service:3001/api/import-csv` para gravar em `/app/data/database.sqlite` (Projeto 1).
3. Dispara o recálculo automático da inteligência artificial preditiva (`master_extracao.py`), atualizando os rankings de reincidência e criticidade de logradouros em tempo real.

Consulte a documentação em [`Colunas filtro.txt`](../Colunas%20filtro.txt) e [`DETALHES_OS_E_POP01.md`](../DETALHES_OS_E_POP01.md) para a especificação das colunas e dos 32 campos de vistoria do POP 01.
