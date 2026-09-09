# 🧠 Memória do Sistema (SanealA)

Este documento atua como o **Changelog** e **Base de Conhecimento Central** do projeto SanealA. Ele registra todas as evoluções, arquiteturas criadas, heurísticas aplicadas e integrações realizadas.

**Visão Geral:** O SanealA é uma plataforma preditiva que une Machine Learning (Random Forest) e NLP (Grok 4.1 Fast) para antecipar falhas de infraestrutura, focando em "Recency-First" para reduzir o passivo operacional e aumentar a eficiência das equipes de campo.

---

## 📅 Histórico de Versões e Melhorias

### 🚀 [v1.0.0] - Gênese e Estruturação Core (Semana 1)
- **Criação do Backend:** Setup do FastAPI (`main.py`) rodando na porta 8000.
- **Integração Básica:** Conexão nativa via API REST com o Supabase (ignorando a biblioteca oficial para evitar problemas de concorrência assíncrona).
- **Setup de Variáveis (`.env`):** Configuração segura de `SUPABASE_URL`, chaves e `OPENROUTER_API_KEY`.

### 🧠 [v1.1.0] - Pipeline de Machine Learning
- **Estruturação do Módulo ML:** Criação dos arquivos `features.py`, `preprocessing.py`, `training.py`, `prediction.py` e o orquestrador `pipeline.py`.
- **Feature Engineering:** Criação de variáveis preditivas como:
  - `q_mat_total`, `q_logr_total`
  - `dias_desde_ultimo`
  - Histórico temporal (6m, 12m, 24m)
- **Modelo RandomForest:** Treinamento configurado com `class_weight='balanced'` nativo do scikit-learn. O modelo gera probabilidades (0% a 100%) em vez de apenas prever 0 ou 1.
- **Exportação:** Salvamento do modelo treinado no arquivo `ml/models/saneala_rf_v1.joblib`.

### 🗣️ [v1.2.0] - NLP e Agente de IA
- **Módulo NLP:** Criação do `agent/nlp.py` integrado com OpenRouter (utilizando o modelo `x-ai/grok-4.1-fast` configurado como motor principal).
- **Análise de Sentimento:** O Agente agora lê o campo de "observação" (texto-livre do técnico) e classifica o estado do cliente (ex: *Irritado*, *Agressivo*, *Calmo*), agregando isso ao relatório final.

### 🔌 [v1.3.0] - Integração Lovable Edge
- **Endpoint Inteligente:** Criação da rota `POST /api/integrations/analyze-external-demands`.
- **Motor de Análise (`analyzer.py`):** O "Cérebro" que une a probabilidade matemática do modelo `.joblib` com a análise de texto do `nlp.py`.
- **Heurística Recency-First:** Implementação de regras de negócio onde chamados antigos (>12 meses) têm peso drasticamente reduzido, focando a "Atenção Crítica" nos últimos 6 meses.

### 📊 [v1.4.0] - Dashboard Local (Dark/Light Mode)
- **Desenvolvimento Visual:** Criação de `static/index.html` e `static/css/dashboard.css`.
- **Evolução de Estilo:** Migração de um estilo hacker (Dark Blue) para um **Light Theme Minimalista** e corporativo (Branco, Cinza e Azul Embasa), alinhando a identidade visual com o Painel Lovable.
- **Controle Retrain:** Implementação de botão no Dashboard para acionar o `ml.pipeline` via interface gráfica.

### 🎯 [v1.5.0] - Refinamento de Precisão e Vocabulário (Calibração)
- **Proteção Contra Falsos Positivos:** Identificado que ruas com alto volume (ex: 200 chamados) geravam risco 98% para moradores novos (0 chamados).
  - *Correção:* Se a matrícula não tem histórico em 12 meses, a contribuição do logradouro no Risco/Score é limitada a no máximo 20-30%.
- **Terminologia Operacional:** Substituição da palavra alarmismo "Risco" por "Probabilidade de Recorrência". "Risco Crítico" substituído por "Alerta Operacional / Atenção Redobrada".
- **Granularidade do Relatório:** O Insight Técnico gerado agora divide claramente:
  - Histórico Histórico Total (Matrícula)
  - Histórico Recente (12m e 6m)
  - Taxa da Rua nos últimos 6 meses.

### 🐳 [v1.6.0] - Preparação para Produção (VPS e GitHub)
- **Dockerização:** Criação de `Dockerfile` otimizado (Python 3.10 slim) e `docker-compose.yml`.
- **Controle de Versão:** Configuração do `.gitignore` protegendo a pasta `desenvolvimento` (dados brutos).
- **Documentação:** Criação de um `README.md` abrangente para o GitHub, explicando a arquitetura e como rodar o projeto.

---

## 🛠️ Próximos Passos (Backlog Ativo)
- [ ] Mover o código via GitHub Push para a VPS.
- [ ] Executar o `docker compose up -d` no servidor de Produção.
- [ ] Alterar o IP do Lovable para apontar para o Back-end da VPS definitivmente (removendo túneis localhost.run).
- [ ] Configurar rotina/cron job para o sistema rodar o retreinamento sozinho 1x por semana na nuvem.
