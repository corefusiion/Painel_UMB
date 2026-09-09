# 🚀 Passo a Passo: Como Rodar o Ecossistema no OpenShift

Fala, Efrain! Tudo bem?

Preparei este guia direto ao ponto para você subir todo o ecossistema no cluster **Red Hat OpenShift (OCP)** da Embasa com o menor esforço possível.

Já deixei os manifestos de contêineres, volumes, serviços e rotas configurados na pasta [`openshift/`](openshift/).

---

## 🎯 Escopo do Primeiro Momento (Fase 1)

Para iniciarmos de forma rápida e segura, dividimos a implantação em duas etapas:

* **Fase 1 (Agora):** Foco total em colocar no ar o **Painel Gerencial (Projeto 1)** recebendo os dados das **pendências (ordens de serviço em aberto)** enviadas pela mensageria do SCI Web de teste.
* **Fase 2 (Próxima etapa):** Com a Fase 1 homologada e rodando estável, avançamos para alimentar a base histórica do **SaneaIA (Projeto 3)** com Machine Learning / predições de reincidência e a ingestão dos **Detalhes da OS** para a auditoria de campo e conformidade com o **POP 01** (leitura, número do hidrômetro, pressão em mca, fotos, etc. — conforme documentado em [`DETALHES_OS_E_POP01.md`](DETALHES_OS_E_POP01.md)).

---

## 🛠️ Passo a Passo de Implantação

### 1. Clonar o Repositório
No seu terminal ou ambiente de desenvolvimento da Embasa:
```bash
git clone https://github.com/corefusiion/Painel_UMB.git
cd Painel_UMB
```

---

### 2. Acessar o seu Namespace no OpenShift
Faça login no cluster e selecione o projeto/namespace onde as aplicações vão rodar (por exemplo, `embasa-umb`):
```bash
oc project <seu-namespace>
```

---

### 3. Construir as Imagens no Registro do Cluster
Como os três módulos já possuem `Dockerfile` próprio e otimizado, basta disparar o build no registro interno do seu OpenShift:

```bash
# 1. Painel de Gestão (Node.js + React)
oc new-build --name gestao-app --binary --strategy docker
oc start-build gestao-app --from-dir="./1 - gestoaumb" --follow

# 2. SaneaIA (FastAPI + ML)
oc new-build --name saneaia-app --binary --strategy docker
oc start-build saneaia-app --from-dir="./3 - Saneaia" --follow

# 3. Receptor de Webhook (Python)
oc new-build --name webhook-app --binary --strategy docker
oc start-build webhook-app --from-dir="./2 - extracao_pendencias" --follow
```

---

### 4. Subir todos os Manifestos em 1 Comando
Na raiz do projeto clonado, aplique a pasta `openshift/`:
```bash
oc apply -f openshift/
```

O que o OpenShift vai criar automaticamente para você:
1. **`painel-umb-storage`**: Volume persistente compartilhado (PVC 10GB) para os bancos SQLite ficarem salvos e duráveis em `/app/data`.
2. **`painel-umb-config`**: ConfigMap com as variáveis de rede interna do cluster.
3. **Pods e Services**:
   * `gestao-service` (Porta 3001 interna)
   * `saneaia-service` (Porta 8000 interna)
   * `webhook-service` (Porta 3002 interna)
4. **Rotas Externas (`06-routes.yaml`)**: Gera os links públicos na rede da Embasa.

---

### 5. Descobrir os Links de Acesso
Assim que os pods subirem, execute:
```bash
oc get routes
```

O OpenShift vai te mostrar as duas URLs geradas:
* **Link 1 (Painel Gerencial - Projeto 1):** `painel-umb-route`
  👉 Acesse pelo navegador para ver o painel com as ordens de serviço, mapas e gráficos operacionais.
* **Link 2 (Central de IA SaneaIA - Projeto 3):** `saneaia-route`
  👉 Acesse pelo navegador para ver a interface do SaneaIA e a documentação interativa Swagger (`/docs`).

---

## 6. Como Conectar a Mensageria do SCI ao Webhook

Agora só falta apontar a mensageria do SCI Web de teste (`integracao-sci-digiteam`) para o nosso Webhook receber o JSON das pendências. 

Você pode escolher a forma que for mais conveniente na sua infraestrutura:

### Opção A: Comunicação Interna no Cluster (Recomendada se o SCI estiver no mesmo cluster)
Aponte o envio da mensageria direto para o Service interno:
```text
http://webhook-service:3002/webhook
```
*(ou usando o domínio completo: `http://webhook-service.<seu-namespace>.svc.cluster.local:3002/webhook`)*

### Opção B: Comunicação Externa via Rota HTTP/HTTPS
Se a mensageria disparar por fora do cluster, use a URL que o OpenShift gerou para a rota do painel com o sufixo `/webhook`:
```text
http://<url-gerada-da-painel-umb-route>/webhook
```

---

## 🔍 Como o Webhook Processa os Dados (Automático)
Assim que a mensageria enviar o JSON das pendências de falta d'água:
1. O contêiner do Webhook recebe os dados 24/7.
2. Normaliza os campos e grava no banco da Gestão (`database.sqlite`) e na base do SaneaIA (`saneaia.db`).
3. O Painel Gerencial atualiza em tempo real a tabela e os indicadores na tela.

Qualquer dúvida ou ajuste específico que precisar no cluster, estou por aqui para apoiar!
