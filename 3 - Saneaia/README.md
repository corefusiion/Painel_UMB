# 💧 SanealA - Plataforma de Inteligência Operacional Preditiva

![SanealA Logo](https://img.shields.io/badge/SanealA-Intelig%C3%AAncia_Operacional-0052cc?style=for-the-badge&logo=water)
![Python](https://img.shields.io/badge/Python-3.14-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109.2-009688?style=for-the-badge&logo=fastapi)
![Machine Learning](https://img.shields.io/badge/Machine_Learning-Scikit_Learn-orange?style=for-the-badge&logo=scikit-learn)

**SanealA** é uma plataforma de Inteligência Artificial e Machine Learning de ponta, desenvolvida para transformar dados operacionais em inteligência estratégica no setor de saneamento. O sistema atua como um "cérebro central" que analisa massas de dados históricos (~74 mil registros) para prever problemas antes que eles se tornem crises críticas, otimizando a tomada de decisão e reduzindo o passivo operacional.

---

## 🚀 Arquitetura e Funcionalidades

O SanealA combina quatro camadas integradas para oferecer uma solução robusta e resiliente:

### 🧠 1. Inteligência Híbrida (ML & NLP)

O grande diferencial do projeto é a união de dois motores de inteligência:

*   **Inteligência Matemática (Machine Learning):** Utiliza um modelo *Random Forest Classifier* treinado para calcular a **Probabilidade de Recorrência**. Ele identifica padrões em variáveis como tipo de serviço, logradouro e recência cronológica, entregando um score de 0 a 100%. A lógica prioriza eventos recentes (últimos 6 meses).
*   **Inteligência Cognitiva (NLP - Grok 4.1 Fast):** Utiliza o motor de linguagem do Grok para processar as observações em texto livre. Ele identifica o sentimento do cliente (Irritado, Agressivo, Calmo) e extrai nuances contextuais que os números sozinhos não captam.

### 🤖 2. Relatório Técnico e Insights
A integração cruza a predição matemática com a heurística de inteligência para gerar recomendações em linguagem humana clara. O sistema diferencia se a instabilidade é pontual (na matrícula do cliente) ou sistêmica (no logradouro/vizinhança), emitindo alertas calibrados como:
- **Alerta Operacional / Atenção Redobrada**
- **Alerta por Logradouro** (quando o problema é da rede pública na rua)
- **Análise de Passivo** (para infraestruturas antigas e estáveis)

### 🛡️ 3. Causal Fingerprinting (Hydraulic DNA)
O SanealA agora possui um motor de **Clustering Espaço-Temporal** que identifica a causa raiz de falhas:
- **Eventos Mestres:** Identifica automaticamente se múltiplas reclamações vizinhas são sintomas de um evento maior (ex: rompimento de adutora).
- **Diagnóstico Isolado:** Heurística baseada em conhecimento de campo para identificar **Obstruções de Ramal** em imóveis específicos quando a rede ao redor está estável.

### 🔌 4. API e Conectividade
A API construída em **FastAPI** serve como ponte entre os motores de IA e os painéis de consumo (ex: Lovable, Supabase Edge Functions).
- Recebe requisições via `POST /api/integrations/analyze-external-demands`.
- Retorna JSONs estruturados para enriquecer Dashboards gerenciais em tempo real.

---

## 📉 Dashboard Gerencial Local

O SanealA conta com um **Dashboard Minimalista Light Mode** (em `static/index.html`) com identidade visual corporativa (Azul Embasa). Ele permite:
- **Monitoramento de Métricas:** Visualizar Accuracy, Recall e Precision do modelo atual.
- **Retreinamento "One-Click":** Acionar o pipeline de retreinamento (`ml.pipeline`) diretamente pela interface para que o modelo aprenda com novos dados inseridos no Supabase.
- **Visualização de KPIs:** Acompanhar volumes de solicitações e tendências temporais.

---

## 🐳 Deploy e Produção (VPS)

O projeto é totalmente dockerizado e está configurado para rodar 24/7 em uma **VPS (Virtual Private Server)**, garantindo uma URL fixa e estável para integrações externas.

```bash
docker compose up -d --build
```
*Isto irá construir a imagem encapsulada e iniciar a API de forma persistente. Basta configurar o Nginx na VPS para expor o servidor na web e o sistema funcionará 24/7 sem necessidade de túneis locais.*

---

**SanealA** - *Antecipando a manutenção, evitando a reclamação.* 
