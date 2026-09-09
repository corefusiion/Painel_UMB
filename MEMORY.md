# MEMORY: Registro Histórico de Arquitetura e Evolução de Engenharia

Este documento consolida o histórico evolutivo de engenharia de software e arquitetura de dados do ecossistema UMB (Painel Operacional UMB & SaneaIA), detalhando decisões técnicas, refatorações de backend, modelos preditivos e marcos de integração.

**Autor e Engenheiro Responsável:** Gleisson Santos - Embasa UMB  
**Organização:** EMBASA - Empresa Baiana de Águas e Saneamento S.A.  
**Classificação:** Registro Técnico Interno  

---

##  Registro de Melhorias

#### [04/08/2026] - Iteração Inicial (Auditoria Base)
**O que foi feito:**
- Levantamento estrutural simultâneo nas 3 frentes do projeto (1-gestoaumb, 2-extracao_pendencias, 3-Saneaia).
- Identificada e mapeada a tecnologia, os módulos críticos, os pontos fortes e as vulnerabilidades técnicas (credenciais expostas, falhas potenciais em React Query, falta de testes, etc).
- Estabelecido este arquivo `MEMORY.md` como protocolo de versionamento de estado e arquitetura.

### [04/08/2026] - Iteração 1: Desacoplamento e Backend Local (Pasta 1)
**O que foi feito:**
- Iniciamos os trabalhos pela **Pasta 1 (`1 - gestoaumb`)**.
- **Ações Técnicas Realizadas:**
  - `package.json` desintoxicado (removidas dependências proprietárias de nuvem).
  - Configuração do Vite purificada e exposta para a rede local (`0.0.0.0`).
  - Desenvolvido um motor backend local robusto (Express + SQLite) na pasta `backend/`.
  - Criado o arquivo `seed.ts` para espelhar as tabelas do sistema e inicializado o banco `database.sqlite`.
  - Escrito e executado script para interceptar todas as chamadas nos React Hooks (`src/hooks/`) e substituí-las por requisições API dinâmicas apontando para a rede local (`API_URL`).
  - Realizada a correção de erros de build TypeScript (relacionados ao Auth Hook e CSS imports).
  - O projeto foi testado com `npm run build` localmente e o build ocorreu com sucesso.

### [07/08/2026] - Parametrização, Estruturação de Logs e Saneamento (Pasta 3)
**O que foi feito:**
- Adicionada a dependência `loguru` ao `requirements.txt` para estruturação de logs.
- O arquivo `config/settings.py` foi atualizado com `ml_prediction_limit: int = 5000`, mapeando parâmetros que antes eram fixos.
- Substituídos os `print()` convencionais por chamadas do `logger` (info, error, warning, debug) em `main.py`, `agent/analyzer.py`, `api/routes/agent.py` e `api/routes/integrations.py`.
- O `analyzer.py` passou a utilizar `settings.ml_prediction_limit` ao consultar a base de dados, eliminando o limite fixo de 100.

**Onde paramos (Próximos Passos):**
- Os refinamentos da Pasta 1 e Pasta 3 (relacionados a .env e loguru/parametrização) estão concluídos e operacionais.
- Foco na Pasta 2 (ocultação de credenciais e concorrência de threads) e testes unitários na Pasta 3.

### [10/08/2026] - Correção do Filtro de Ano, Status das Solicitações e Redesign NLP
**O que foi feito:**
- **Correção do Filtro de Ano (`created_at` removido):** Eliminada a condição `created_at LIKE '%2026%'` de todas as queries de analytics (`get_kpis`, `get_analytics_bairros_criticos`, `get_analytics_por_logradouro`, `get_analytics_por_servico` e `get_tabela_geral`). Como `created_at` continha a data de criação do registro no banco local (2026), todos os 54.640 registros históricos de 2023-2025 eram erroneamente contados. Com a correção, a seleção do ano **2026** no Dashboard filtra com precisão cirúrgica as **7.518 OSs** do ano de 2026.
- **Correção da Classificação de Status ("Concluídas Não Executadas"):** Identificada a falha onde a string `"CONCLUÍDA NÃO EXECUTADA"` continha o trecho `"EXECUTAD"`, fazendo com que 1.853 solicitações não executadas fossem somadas como executadas. A ordem de checagem foi invertida em `analyzer.py`. O status de 2026 agora reporta fielmente a realidade:
  - **Concluídas Executadas:** **5.612 OSs** (75,0%)
  - **Concluídas Não Executadas / Canceladas:** **1.867 OSs** (24,9% — sendo 1.853 não executadas e 14 canceladas)
  - **Pendentes Ativas:** **6 OSs** (0,1%)
- **Tratamento do Serviço `37 - VISITA`:** Excluído o serviço `37 - VISITA` da contagem de "Principais Serviços Solicitados pelo Cliente", pois representa conversão interna de campo devido a impedimentos de acesso/inviabilidade (807 OSs), evidenciando os serviços primários reais dos clientes (ex: `364 - VERIF FALTA AGUA IMOVEL` com 6.643 OSs).
- **Redesign do Encart NLP de Observações (`NlpObservacoesCard.tsx` & `3 - Saneaia/static/js/dashboard.js`):** Atualizado tanto no Painel de Gestão (React - Porta 8080) quanto no Painel Nativo do SaneaIA (Static JS - Porta 8000). Removidas todas as cores de fundo azul e verde, bem como bordas coloridas laterais (`border-left: 4px solid #3B82F6` e `#10B981`), adotando um visual 100% neutro e elegante. Foram separadas e rotuladas explicitamente duas seções com identificação inconfundível de período:
  1. **Análise Mensal — Mês Corrente (Agosto/2026: 01/08 a 31/08/2026)** -> Exibe o grid com os 5 indicadores específicos do mês: **12.2% Sentimento Negativo**, **4.7% Taxa Urgência**, **12 Solicitações Urgentes**, **21.2% Sentimento Positivo** e **29.0% Localização Extraída**.
  2. **Análise Anual — Acumulado do Ano (Ano 2026: 01/01 a 31/12/2026)** -> Exibe o grid com os 5 indicadores específicos do ano: **9.3% Sentimento Negativo**, **3.3% Taxa Urgência**, **241 Solicitações Urgentes**, **19.7% Sentimento Positivo** e **16.3% Localização Extraída**, além das categorias técnicas.

### [14/08/2026] - Conclusão do Chat IA Inteligente (Text-to-SQL) (Pasta 3)
**O que foi feito:**
- **Orquestração Text-to-SQL no Chat:** Finalizada a integração completa das diretrizes de prompts órfãs em `prompts.py`. Agora, o chat realiza um fluxo inteligente:
  1. Planeja a consulta SQLite ideal para a pergunta do usuário usando `SQL_PLANNER_SYSTEM_PROMPT`.
  2. Sanitiza o output SQL removendo blocos markdown/cercas geradas pela IA.
  3. Registra dinamicamente as funções customizadas de ML/NLP (`PREDICT_REINCIDENCIA`, `ANALYZE_SENTIMENT`, `DETECT_URGENCY`, `CATEGORIZE_TECHNICAL`) na conexão SQLite para permitir queries inteligentes diretamente no banco.
  4. Executa a query planejada na base local `saneaia.db`.
  5. Envia o resultado do banco (JSON) para formatação de resposta do Gemini com o prompt executivo de suporte (`CHAT_ANSWER_SYSTEM_PROMPT`).
- **Fluxo de Fallback Resistente:** Em caso de perguntas genéricas fora de escopo (retornando `NONE`) ou falhas sintáticas de queries, aciona o fallback seguro (`_chat_fallback`) injetando contexto operacional básico e respondendo em caráter de SaneaIA via `CHAT_SYSTEM_PROMPT`.
- **Testes Unitários:** Scripts `test_text_to_sql.py` e `test_chat_integration.py` criados na pasta de rascunhos para validar com sucesso o pipeline fim-a-fim em ambos os cenários (planejado vs fallback).

### [14/08/2026] - Correção dos Filtros Temporais (Ano) no Chat IA & Integração OpenRouter (Pasta 3)
**O que foi feito:**
- **Correção de Filtros Temporais no Planejador SQL:** Solucionado o bug onde o chat respondia erroneamente sobre o ano de 2026. A IA gerava consultas SQLite usando `strftime('%Y', data_ultima_tramitacao) = '2026'` na tabela `solicitacoes`. Como as datas nessa tabela são strings em formato brasileiro (`DD/MM/YYYY`), funções nativas como `strftime` retornavam NULL, resultando em contagem zero de OSs em 2026. A IA então afirmava que a situação estava regular (0 chamados) e exibia dados históricos gerais de outros anos (ex: ITAPUA com 7.928 chamados acumulados de todo o histórico) tirados de seu contexto ou de consultas sem filtro.
- **Melhorias no `SQL_PLANNER_SYSTEM_PROMPT`:** Adicionadas diretrizes explícitas no prompt instruindo o modelo a nunca usar funções nativas de data diretamente em `solicitacoes` devido à formatação brasileira e **sempre redirecionar consultas de filtro temporal (ano/mês/tempo de resolução) ou agrupamentos anuais para a view `solicitacoes_analise`**, utilizando as colunas pré-calculadas `ano` e `mes_numero`.
- **Suporte Nativo ao OpenRouter:** Refatorada a classe `LLMClient` (`llm_client.py`) para suportar chaves OpenRouter (`OPENROUTER_API_KEY`) e modelos configurados via `.env`, mantendo fallback transparente para a API direta do Gemini.
- **Robustez no Contexto de Fallback:** O método `_chat_fallback` em `analyzer.py` foi ampliado para calcular e injetar as métricas exatas de total de chamados e chamados de falta d'água para o ano detectado ou acumulado histórico, garantindo respostas baseadas em dados mesmo se o planejador falhar.

### [17/08/2026] - Otimização Completa de Responsividade e Correção de Sizing (Pasta 1)
**O que foi feito:**
- **Eliminação de Rolagem Vertical Desnecessária (Scroll Fantasma):**
  - Identificados e corrigidos conflitos na árvore de layout onde propriedades `h-full` eram aplicadas concorrentemente a propriedades flexíveis `flex-1` e `min-h-0` em containers filhos com cabeçalhos irmãos (Coluna 2 de Análise Preditiva e Coluna 3 de Ordens de Serviço). Isso forçava os elementos a ultrapassarem a altura calculada da viewport.
  - Removido `h-full` redundante do container de dados da tabela em `ServiceOrdersTableCard.tsx`, garantindo que a tabela e a sua paginação permaneçam fixas dentro do espaço visível do card, eliminando o scroll de página.
  - Implementada a unidade dinâmica de viewport `h-[100dvh]` no container principal (`Index.tsx`) e definidas regras globais de altura e controle de overflow (`height: 100%; overflow: hidden; margin: 0; padding: 0;`) para `html`, `body` e `#root` em `index.css`.
- **Aproveitamento de Telas Grandes e TVs (Ultra-wide e 4K):**
  - Limitada a largura máxima do grid principal em `Index.tsx` para `max-w-[1920px] mx-auto`, alinhando-o perfeitamente na vertical com o cabeçalho superior (`DashboardHeader.tsx`) e evitando esticamentos desagradáveis e vazios de linhas em TVs de grande porte e telas de altíssima resolução.
- **Responsividade Aprimorada para Tablets e Notebooks Pequenos:**
  - Reformulado o layout para telas menores que `1280px` (`xl:hidden`) em `Index.tsx` de uma pilha vertical única e desproporcional para uma grade fluida baseada em Tailwind CSS Grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3` e `lg:grid-cols-5`). A nova grade otimiza o uso horizontal de espaço em tablets de alta densidade e telas intermediárias, mantendo a legibilidade de tabelas, KPIs e gráficos sem scrolls desnecessários.
- **Validação de Build:**
  - O projeto foi testado em ambiente de produção local via `npm run build`, concluído com 100% de sucesso sem erros de compilação ou lints associados.

### [17/08/2026] - Finalização de Dependências, Script Batch e Documentação de Inicialização
**O que foi feito:**
- **Correção de Dependências no SaneaIA (FastAPI + Pydantic):**
  - Detectado erro de runtime no microserviço (`ImportError: cannot import name 'PYDANTIC_V2' from 'fastapi._compat'`).
  - Identificada a causa raiz: a presença de um diretório duplicado corrompido `_compat` dentro do pacote `fastapi` (no site-packages do ambiente virtual `venv`) que mascarava o arquivo padrão `_compat.py`.
  - Efetuada a remoção completa da pasta corrompida via Python, restabelecendo a importação padrão do FastAPI através de `_compat.py`. O ambiente virtual agora inicializa o microserviço Uvicorn perfeitamente sem falhas.
- **Script Batch de Inicialização Única (`start-servers.bat`):**
  - Criado o script `start-servers.bat` na raiz do ecossistema.
  - O script foi estruturado com caminhos relativos e controle de tempo (`timeout`) para levantar de forma sequencial o Backend do Gestão UMB (porta `3001`), o Frontend do Gestão UMB (porta `8080`) e a API FastAPI SaneaIA (porta `8000`) em novas janelas do Windows Command Prompt.
- **Documentação de Inicialização Local (`README.md`):**
  - Criado o arquivo `README.md` na raiz do projeto com instruções de execução, tabela de portas e serviços utilizados, orientações sobre como derrubar os servidores e comandos manuais para execução isolada de cada módulo.
- **Melhoria no Chat IA (Mapeamento de Conformidade POP):**
  - Identificada a ausência das colunas pré-calculadas de conformidade (`atende_pop` e `pop_motivo`) da tabela `detalhes_os` nas diretrizes do `SQL_PLANNER_SYSTEM_PROMPT`.
  - Atualizado o arquivo [`prompts.py`](file:///C:/Users/t034183/Desktop/UMBMAS/3%20-%20Saneaia/agent/prompts.py) com a documentação destas colunas e a instrução clara para que o planejador SQL realize queries simplificadas (ex: `WHERE do.atende_pop = 'Não'`).
  - Executados testes de validação via terminal de forma assíncrona (`test_chat.py`) que confirmaram que o planejador gera a query otimizada com JOIN e filtragem perfeita de conformidade POP no SQLite, funcionando com fallback automático do Gemini Direct em caso de créditos esgotados na chave do OpenRouter.

- **Evolução para Chat IA Profissional com Histórico Persistente e Memória:**
  - **Tabelas do Banco Local (SQLite):**
    - `conversations`: Armazena cabeçalho da conversa, contadores de mensagens, pinned (0/1), e prévia da última mensagem.
    - `messages`: Armazena histórico completo (user/assistant) com relacionamento real.
    - `conversation_memory`: Mantém o resumo/summary consolidado da conversa.
    - Tabelas criadas de forma segura e não destrutiva no startup através de `setup_chat_tables()` no setup da conexão do SQLite.
  - **API e Rotas Backend (`agent.py`):**
    - Implementadas rotas REST completas para `/api/agent/conversations` (GET, POST, GET/:id, PATCH/:id, DELETE/:id, GET/:id/messages, POST/:id/messages).
    - Métodos adicionados na classe `SaneaiaAnalyzer` para ler e salvar conversas, mensagens e resumos diretamente no SQLite local.
  - **Estratégia de Memória e Contexto:**
    - Contexto montado dinamicamente: `SYSTEM_PROMPT` + `Resumo da conversa anterior` + `Últimas 10 mensagens` + `Pergunta atual`.
    - Resumos atualizados de forma eficiente (a cada 6 mensagens novas) usando uma tarefa assíncrona para evitar atrasos na resposta.
    - Título automático gerado a partir do primeiro envio de mensagem através de uma heurística inteligente local, rápida e sem custo.
    - Implementada deleção segura em cascata (Cascade Delete) das mensagens e memórias ao remover uma conversa.
  - **Interface Front-end (Sidebar e Ações):**
    - Restruturado o HTML de chat em `index.html` dividindo o painel em Sidebar de conversas (à esquerda) e Chat principal (à direita).
    - Criados botões e rotinas de controle no `dashboard.js`: "+ Nova conversa", "Fixar/Desafixar" (pinned), "Renomear", e "Excluir".
    - Ordenação dinâmica implementada na sidebar (conversas fixadas no topo e ordenação geral por data de atualização decrescente).
    - Persistência e restauração automática da conversa atual (via `localStorage`) para que atualizações de página ou reloads não interrompam a experiência do usuário.
  - **Testes de Integração:**
    - Criado e executado o script `test_chat_persistence.py` para validar fluxos locais do chat.
- **Correção de Dependências:** Removido diretório corrompido `_compat` do FastAPI.
- **Script de Inicialização:** Criado `start-servers.bat` para automação sequencial.
- **Documentação Local:** README.md criado na raiz.
- **Chat IA - Evolução de Memória/Histórico:** Tabelas `conversations`, `messages`, `conversation_memory` criadas; rotas REST implementadas; contexto montado dinamicamente com resumos periódicos.
- **Reformulação Visual do Chat:** Estilo editorial (ChatGPT/Claude), sidebar com ações hover, textarea expansível e Empty State interativo.

### [17/08/2026] - Segurança de Credenciais, Thread Safety e Cobertura de Testes
**O que foi feito:**
- **Segurança (Credenciais Expostas) na Pasta 2:** Migração de credenciais para `.env` com `python-dotenv`.
- **Concorrência Segura (Threads Lock) na Pasta 2:** Proteção de variáveis globais em `pesq_exp` com `threading.Lock()`.
- **Resiliência e Fallback Local de Memória no Chat IA (Pasta 3):** Lógica de fallback para resumos em caso de erro 429/402 das APIs.
- **Testes de Cobertura da API (Pasta 3):** Criado `test_api_endpoints.py` testando todos os 9 endpoints principais.
- **Execução e Validação de Testes:** Confirmação de 100% de sucesso nas suites de persistência e endpoints.

### [17/08/2026] - Análise Visual, Profiling de Dados e Geração de Gráficos
**O que foi feito:**
- **Inventário Visual do Projeto:** Executado o mapeamento e escaneamento das superfícies e componentes de monitoramento no repositório, catalogando arquivos contendo gráficos, queries e filtros.
- **Profiling de Dados Reais:** Atualizado o script `profile_dataset.py` com fallback automático de delimitador `;` para ler e analisar corretamente a base real `falta_dagua_ex_consolidado.csv`, salvando os metadados em `reports/visual-inventory/dataset_profile.json`.
- **Geração de Gráficos Dark-Theme:** Instalada a dependência `matplotlib` no ambiente virtual local do Python e implementado o script `aggregate_and_plot.py` que gera os rankings operacionais em formato PNG (`top_bairros.png` e `situacao_dist.png`) na pasta `reports/visual-inventory/`.
- **Especificações e Relatório Visual:** Criado o documento `reports/visual-inventory/visual_report.md` descrevendo os casos de uso, matriz de métricas, fichas de especificação dos novos visuais, limites e acessibilidade dos gráficos do ecossistema.

### [17/08/2026] - Correção de Importações e Ejeção de Supabase no Frontend
**O que foi feito:**
- **Restauração de Arquivos Deletados:** Recuperados arquivos cruciais de hooks e componentes do dashboard que foram removidos do repositório por engano (`PavementDonutChart.tsx`, `PavimentosStatsCard.tsx`, `useCarroPipa.ts`, `usePavimentos.ts`, `useVazamentos.ts`, `geocoding.ts`, `Manutencao.tsx`, `useDeltaYesterday.ts`, `useDnaHidraulico.ts`).
- **Integração com Express Backend:** Refatorados todos os hooks recuperados (`useCarroPipa.ts`, `usePavimentos.ts`, `useVazamentos.ts`, `useDeltaYesterday.ts`) para realizar chamadas REST à API Express local (`API_URL`) no lugar do cliente Supabase e aplicar filtragem por data em memória.
- **DNA Hidráulico Dinâmico:** Atualizado `useDnaHidraulico.ts` para resolver de forma dinâmica o endereço local da API FastAPI SaneaIA (`port 8000`) utilizando `window.location.hostname` em vez de um IP fixo externo.
- **Validação de Compilação:** Executado `npm run build` confirmando 100% de sucesso na transpilação e geração dos bundles estáticos de produção.

### [18/08/2026] - Integração Webhook para Alimentação Direta (Embasa Views)
**O que foi feito:**
- **Script Webhook Listener com Carga Dupla:** Criado o script [`listener_recebimento.py`](extracao_pendencias/listener_recebimento.py) em Python (Porta 3002) rodando um servidor HTTP que escuta pushes da Embasa e realiza carga dupla:
  1. Primeiro, insere TODOS os registros e serviços brutos diretamente na tabela `solicitacoes` do banco SQLite do Projeto 3 (`saneaia.db`).
  2. Segundo, separa e classifica os registros em 5 blocos operacionais, encaminhando para as tabelas do banco SQLite do Projeto 1 (`database.sqlite`).
- **Desambiguação de Cabeçalhos de Observações:** Atualizados os mapeamentos de cabeçalhos no backend Express (`server.ts`) e no webhook Python (`listener_recebimento.py`) para diferenciar corretamente `Obs da SS` (salvo em `especificacao`) de `Obs de Enc da OS` (salvo em `observacao`), prevenindo conflito de strings.
- **Recálculo de Insights Inteligentes:** O script Webhook aciona automaticamente o recálculo preditivo de IA e NLP no SaneaIA FastAPI e sincroniza as novas conclusões com o banco de dados do Dashboard sempre que novos dados de falta d'água são injetados.
- **Integração no Script de Inicialização Mestre:** Atualizado o script [`start-servers.bat`](/UMBMAS/start-servers.bat) na raiz para inicializar concorrentemente o Webhook Receiver em uma quarta janela do terminal CMD, garantindo que o ecossistema local esteja sempre pronto para receber dados da Embasa.
- **Governança de Agente:** Atualizado [`AGENTS.md`](/UMBMAS/AGENTS.md) registrando a porta 3002 e a funcionalidade do Webhook.

### [19/08/2026] - Desativação Temporária da Tela de Login
**O que foi feito:**
- **Bypass de Autenticação:** Refatorado o hook [`useAuth.ts`](gestoaumb/src/hooks/useAuth.ts) no frontend do Projeto 1 para sempre carregar uma sessão mockada ativa (`{ user: { id: '1' } }`) imediatamente ao montar o componente. Isso faz com que qualquer novo computador ou aba acesse diretamente o Dashboard (Home) sem exigir preenchimento das credenciais de acesso, sem precisar apagar a página de login original.
- **Refatoração do Modal de Importação Frontend:** Refatorado o componente [`ImportDataModal.tsx`](UMBMAS/1%20-%20gestoaumb/src/components/dashboard/ImportDataModal.tsx) para enviar os arquivos CSV carregados na interface diretamente ao endpoint `/api/import-csv` do backend via `FormData` (POST). Isso substitui o parser cliente do React (que estava quebrado e gerava requisições sem efeito) pelo motor unificado e robusto de importação do servidor SQLite.
- **Resolução de Shift de Colunas e Remoção de Fallbacks Posicionais:** Identificado que no CSV real de pendências (13 colunas), os acentos das colunas de cabeçalho (como *"Serviço"* e *"Especificação"*) são removidos pelo sistema na exportação, resultando em cabeçalhos de texto como `"Servio"` e `"Especificao"`. Isso quebrava o mapeador do backend e ativava fallbacks posicionais redundantes baseados no tamanho do cabeçalho que erroneamente vinculavam o `logradouro` (índice 8) ao campo `observacao`. Removemos todos os fallbacks por índice do arquivo [`server.ts`](file:///C:/Users/t034183/Desktop/UMBMAS/1%20-%20gestoaumb/backend/server.ts), aprimoramos o mapeador por regex/nome para suportar a ausência de acentos (`servi`, `especifica`, `matri`) e implementamos um fallback lógico para que `observacao` herde `especificacao` se a primeira estiver ausente no CSV de entrada.

### [09/09/2026] - Blindagem de Webhook, Expurgo Seguro, Logs RUM e Preparação para Nuvem Corporativa
**O que foi feito:**
- **Proxy de Webhook no Backend Express (Porta 8080):** Adicionada a rota `/webhook` no backend Express do Projeto 1 (`server.ts`) atuando como proxy reverso para o listener Python na porta 3002. Isso resolve bloqueios de firewall que impediam conexões diretas na porta 3002, permitindo que sistemas corporativos da Embasa enviem dados via porta padrão já liberada (8080).
- **Assinatura Padronizada de Homologação (`_TESTE_WEBHOOK`):** Injetada de forma nativa e imutável a flag identificadora nos payloads de teste enviados através da interface de homologação (`testar-webhook.html`), prevenindo mistura inadvertida com dados reais.
- **Endpoint de Expurgo Seguro e Exclusão Cruzada:** Implementado endpoint `/api/expurgar-testes` tanto no Express quanto no FastAPI, garantindo a eliminação em lote de registros de homologação em ambas as bases SQLite (`database.sqlite` e `saneaia.db`) com retorno de métricas detalhadas.
- **Automação Headless e Telemetria Logs RUM:** Refatorado o motor de extração para execução headless em segundo plano (`ExtractionManager`) com streaming SSE em tempo real (`/api/extraction/stream`), rastreamento de impacto de novas linhas/atualizações no banco e histórico de execuções persistente.
- **Governança de Versionamento e Segurança LGPD:** Estruturação das diretrizes de segurança no `SECURITY.md`, mitigação de vazamento de dados confidenciais através do isolamento de pastas proprietárias no `.gitignore`, e licenciamento MIT corporativo assinado por Gleisson Santos (Embasa UMB).
- **Preparação para Kubernetes / OpenShift:** Arquitetura desacoplada e 100% conteinerizável validada para subida na infraestrutura corporativa de servidores da EMBASA.