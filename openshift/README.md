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
6. `painel-umb-route`: Rota oficial OpenShift com terminação TLS/HTTPS para acesso na Intranet.

---

## 📡 3. Como Alimentar o Sistema via Webhook

Após a implantação, qualquer sistema corporativo da Embasa pode enviar dados das views (JSON ou CSV) via requisição HTTP `POST` para:
* **Internamente no Cluster:** `http://webhook-service:3002/webhook`
* **Pela URL da Rota Externa:** `https://<url-da-route>/webhook`

Consulte a documentação em [`Colunas filtro.txt`](../Colunas%20filtro.txt) e [`DETALHES_OS_E_POP01.md`](../DETALHES_OS_E_POP01.md) para a estrutura esperada das colunas.
