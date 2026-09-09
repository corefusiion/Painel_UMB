# Diretrizes de Segurança e Conformidade LGPD (SECURITY.md)

Este documento estabelece as normas, práticas de governança de dados e conformidade legal adotadas no ecossistema **UMBMAS (Painel Operacional UMB & SaneaIA)**, assegurando a proteção de informações institucionais, privacidade de dados operacionais e integridade dos sistemas.

**Responsável Técnico:** Gleisson Santos - Embasa UMB  
**Organização:** EMBASA - Empresa Baiana de Águas e Saneamento S.A.  
**Classificação:** Uso Interno Restrito / Confidencial  

---

## ⚖️ 1. Conformidade Estrita com a LGPD (Lei Federal nº 13.709/2018)

O ecossistema UMBMAS foi concebido seguindo a metodologia *Privacy by Design* e atende rigorosamente aos princípios da Lei Geral de Proteção de Dados Pessoais (LGPD):

1. **Princípio da Finalidade e Adequação (Art. 6º, I e II):**
   - Todos os dados processados pelo ecossistema possuem finalidade estritamente operacional e de planejamento público de saneamento básico: monitoramento de solicitações de serviço (SS), ordens de serviço (OS), manutenções de redes, desobstrução, reposição de pavimentos e distribuição emergencial via carro-pipa.
   - O tratamento é respaldado pelo cumprimento de obrigação legal e execução de políticas públicas pelo prestador de serviços de saneamento básico (Art. 7º, II e III da LGPD).

2. **Princípio da Necessidade e Minimização de Dados (Art. 6º, III):**
   - O ecossistema limita-se a processar apenas os dados estritamente necessários para a execução e análise dos serviços operacionais (código de serviço, data/hora de abertura e encerramento, logradouro, bairro e matrícula técnica do imóvel).
   - **Ausência Total de Dados Pessoais Sensíveis:** A plataforma **NÃO coleta, NÃO armazena e NÃO processa** dados pessoais sensíveis (como etnia, religião, biometria, dados de saúde, convicções políticas) nem documentos civis restritos (CPF, RG, dados bancários, senhas de clientes).

3. **Princípio da Segurança e Prevenção (Art. 6º, VII e VIII):**
   - Toda a infraestrutura opera de forma isolada na intranet corporativa da EMBASA ou em contêineres privados gerenciados no cluster Kubernetes / OpenShift, sem exposição a redes públicas desprotegidas.

4. **Eliminação e Expurgo de Testes (Art. 16):**
   - O sistema possui rotinas automatizadas e parametrizadas de expurgo seguro para identificar e excluir imediatamente dados e registros temporários de homologação e testes (identificados pela assinatura `_TESTE_WEBHOOK`), prevenindo poluição da base produtiva e assegurando o ciclo de vida adequado da informação.

---

## 🔒 2. Isolamento de Dados Proprietários no Versionamento (Git)

Para assegurar que bases históricas reais e dados confidenciais nunca vazem para ambientes de código externo:

* **Exclusão Estrita no `.gitignore`:** As pastas de dados brutos e históricos (como `Base dados UMB/`, `dados_brutos/`, `dados_entrada/` e arquivos compactados `.tar.gz` ou `.sql.gz`) estão permanentemente ignoradas no controle de versão.
* **Repositório Privado:** O código-fonte reside em repositório privado com acesso restrito e autenticado.
* **Bancos de Dados de Produção:** Devem permanecer montados em volumes persistentes locais protegidos ou conectados diretamente às instâncias corporativas de banco de dados da EMBASA.

---

## 🔑 3. Gerenciamento Seguro de Credenciais e Segredos

* **Desacoplamento Absoluto:** Nenhuma senha institucional, token corporativo ou chave de API está gravada no código-fonte.
* **Variáveis de Ambiente (`.env`):** Todas as credenciais de acesso a microsserviços ou sistemas legados são injetadas dinamicamente em tempo de execução através de arquivos `.env` locais ou via *Secrets / ConfigMaps* do OpenShift / Kubernetes.
* **Modelos de Exemplo:** O repositório fornece apenas modelos de configuração limpos (`.env.example`), sem credenciais reais.

---

## 🛡️ 4. Segurança na Automação e APIs

1. **Prevenção a Injeção de Código e SQL Injection:**
   - As consultas realizadas pelo motor de IA e pelas rotinas backend utilizam consultas parametrizadas (*prepared statements*) e validação de parâmetros contra o schema do SQLite / PostgreSQL.
2. **Streaming Controlado e RUM:**
   - A central de extração opera em modo seguro (*headless*), registrando logs de telemetria em streaming SSE (`/api/extraction/stream`) sem expor dados confidenciais de credenciais de operadores no log.
3. **Padrão de Autenticação e Perímetros:**
   - Em ambiente de produção na infraestrutura corporativa (OpenShift), a exposição das rotas HTTP é mediada por *Routes* protegidas sob firewall e controle de acesso da EMBASA.

---

## 📬 5. Contato e Reporte de Incidentes

Caso seja identificada qualquer inconsistência, necessidade de saneamento de dados ou comportamento atípico no ecossistema, contatar o responsável técnico:

* **Desenvolvedor Responsável:** Gleisson Santos
* **Unidade:** EMBASA UMB (Unidade Metropolitana de Salvador / Buraquinho)
* **Canal:** Suporte interno institucional EMBASA
