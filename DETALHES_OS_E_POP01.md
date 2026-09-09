# Arquitetura de Detalhes da Ordem de Serviço & Auditoria Automatizada do POP 01
### Plataforma Integrada de Gestão Operacional e Inteligência Analítica — EMBASA / UMB

---

## 1. Visão Geral e Importância Estratégica

A verificação de **Falta d'Água** na EMBASA não se limita ao registro cadastral da Ordem de Serviço. Para assegurar a qualidade do atendimento técnico, a resolução definitiva de problemas de abastecimento e a responsabilização operacional, a Diretoria de Operações estabeleceu o **Procedimento Operacional Padrão nº 01 (POP 01)**.

A tabela **`detalhes_os`** armazena a auditoria completa das vistorias de campo executadas pelas equipes operacionais, fiscalizando:
1. Se a equipe realizou a medição física de pressão no cavalete com manômetro.
2. Se houve conferência e leitura do hidrômetro do imóvel e dos vizinhos.
3. Se foram registradas as evidências fotográficas obrigatórias (mínimo de 3 documentos).
4. Se o diagnóstico técnico de encerramento foi conclusivo e estruturado.
5. Se foi identificada necessidade de desobstrução de ramal e se a OS secundária foi devidamente gerada.

---

## 2. Dicionário de Dados da Tabela `detalhes_os` (32 Atributos)

Abaixo estão detalhados todos os campos coletados e auditados pelo sistema:

| Nº | Campo no Banco | Tipo | Descrição Técnica & Relevância Operacional |
| :--- | :--- | :--- | :--- |
| **01** | `numero_os` | `TEXT PRIMARY KEY` | Número identificador da Ordem de Serviço (chave primária de amarração com `faltadagua_ex`). |
| **02** | `equipe_executora` | `TEXT` | Identificação ou código da equipe de campo que atendeu a ocorrência (ex: prestadora, terceirizada ou própria). |
| **03** | `horas_execucao` | `TEXT` | Duração total despendida pela equipe na execução do serviço no local. |
| **04** | `horas_atendimento` | `TEXT` | Tempo transcorrido entre o deslocamento, atendimento e encerramento. |
| **05** | `hd_numero` | `TEXT` | Número de série físico do hidrômetro instalado no imóvel vistoriado. |
| **06** | `hd_leitura` | `TEXT` | Leitura numérica instantânea registrada no hidrômetro no momento da vistoria. |
| **07** | `hd_pressao` | `TEXT` | **[CRUCIAL POP 01]** Pressão manométrica aferida no cavalete do imóvel em m.c.a. (metros de coluna d'água). |
| **08** | `imovel_pavimentos` | `TEXT` | Quantidade de pavimentos da edificação (térreo, 1º andar, etc.). |
| **09** | `imovel_situacao` | `TEXT` | Situação do imóvel (habitado, fechado, desocupado, em obras). |
| **10** | `imovel_res_inf` | `TEXT` | Existência e estado de reservatório inferior / cisterna no imóvel. |
| **11** | `imovel_res_sup` | `TEXT` | Existência e estado de reservatório superior / caixa d'água. |
| **12** | `ligacao_lacre_cor` | `TEXT` | Cor do lacre de segurança encontrado no hidrômetro/cavalete. |
| **13** | `ligacao_situacao` | `TEXT` | Situação da ligação de água (ativa, cortada, suprimida, clandestina). |
| **14** | `hd_lado_direito` | `TEXT` | Número do hidrômetro do imóvel vizinho à direita. |
| **15** | `hd_lado_direito_leitura` | `TEXT` | Leitura registrada no hidrômetro do vizinho à direita. |
| **16** | `hd_lado_direito_pressao` | `TEXT` | Pressão aferida no imóvel vizinho à direita. |
| **17** | `hd_lado_esquerdo` | `TEXT` | Número do hidrômetro do imóvel vizinho à esquerda. |
| **18** | `hd_lado_esquerdo_leitura` | `TEXT` | Leitura registrada no hidrômetro do vizinho à esquerda. |
| **19** | `hd_lado_esquerdo_pressao` | `TEXT` | Pressão aferida no imóvel vizinho à esquerda. |
| **20** | `sit_abast_apos_exec` | `TEXT` | Situação do abastecimento após a execução (Normalizado, Intermitente, Sem Água). |
| **21** | `necessidade_desob_ramal` | `TEXT` | Informa se a equipe constatou necessidade de desobstruir o ramal predial ('Sim' / 'Não'). |
| **22** | `deseja_gerar_desobstrucao`| `TEXT` | **[AUDITORIA]** Informa se a equipe gerou a OS secundária de desobstrução ('Sim' / 'Não'). |
| **23** | `motivo_falta_dagua` | `TEXT` | Causa raiz atribuída pela equipe (Rede com ar, ramal quebrado, registro fechado, manobra). |
| **24** | `ponto_referencia` | `TEXT` | Referência física do local de atendimento para localização de campo. |
| **25** | `usuario_presente` | `TEXT` | Registra se o morador/solicitante acompanhou a vistoria ('Sim' / 'Não'). |
| **26** | `material_utilizado` | `TEXT` | Descrição de materiais ou conexões aplicadas pela equipe na intervenção. |
| **27** | `obs_encerramento` | `TEXT` | Parecer descritivo técnico detalhado registrado pela equipe ao concluir o chamado. |
| **28** | `qtd_documentos` | `INTEGER`| **[CRUCIAL POP 01]** Quantidade de fotos anexadas (Fachada, Manômetro e Conclusão). |
| **29** | `status_documentos` | `TEXT` | Status de validação dos anexos enviados no sistema de campo. |
| **30** | `atende_pop` | `TEXT` | **Resultado Automático do Motor POP:** `'Sim'`, `'Parcial'` ou `'Não'`. |
| **31** | `pop_motivo` | `TEXT` | Justificativa técnica e detalhamento dos desvios ou conformidades do POP 01. |
| **32** | `criado_em` | `TEXT` | Timestamp ISO 8601 da auditoria e gravação do registro no banco local. |

---

## 3. Motor Inteligente de Avaliação do POP 01

O backend da aplicação avalia automaticamente cada vistoria no momento da inserção:

```mermaid
flowchart TD
    A["Entrada: Dados da Vistoria da OS"] --> B{"Motivo = Roubo/Furto de HD?"}
    B -->|Sim| C["atende_pop = 'Sim'<br>(Isenção por furto reportado)"]
    B -->|Não| D{"Constatou Desobstrução<br>e NÃO gerou OS Secundária?"}
    D -->|Sim| E["FALHA GRAVE<br>atende_pop = 'Não'<br>Equipe omitiu abertura de serviço"]
    D -->|Não| F["Avaliação de 4 Pilares Técnicos"]
    
    F --> P1["1. Mínimo 3 Fotos/Documentos"]
    F --> P2["2. Pressão aferida em mca (com isenção contextual)"]
    F --> P3["3. Leitura de HD de Vizinhos (com isenção contextual)"]
    F --> P4["4. Qualidade e riqueza da Observação"]
    
    P1 & P2 & P3 & P4 --> G{"Pontuação Final"}
    G -->|4 Pontos (100%)| H["atende_pop = 'Sim' (Conforme)"]
    G -->|2 a 3 Pontos| I["atende_pop = 'Parcial'"]
    G -->|0 a 1 Ponto| J["atende_pop = 'Não' (Não Conforme)"]
```

### Isenções Contextuais Inteligentes
Se o técnico registrar na observação que o morador estava ausente, o imóvel estava fechado ou o vizinho recusou acesso, o sistema **não penaliza injustamente a equipe** pela ausência da medição manométrica, concedendo isenção justificada e documentada em `pop_motivo`.

---

## 4. Estratégia de Operação e Carga de Dados

A arquitetura foi projetada para operar em dois modos complementares:

### Modo 1: Carga Corporativa Direta pela TI (Via Webhook ou API REST)
Caso a TI da Embasa (Efrain) consiga disponibilizar uma View com a união dos dados de vistoria ou exportar a tabela do sistema de campo (Digiteam), a carga é realizada em lote através do endpoint:
* **`POST http://<servidor>:3001/api/detalhes_os/bulk`**
* **Corpo:** Array JSON contendo os objetos mapeados com as colunas da tabela acima.
* **Resultado:** O motor de auditoria processa as regras de negócio em milissegundos e grava no SQLite.

### Modo 2: Extração Automatizada em Segundo Plano (`detalhar_ss_os.py`)
Caso a TI da Embasa demore ou tenha dificuldades em extrair as vistorias de campo via banco de dados:
* O robô em Python [`detalhar_ss_os.py`](2%20-%20extracao_pendencias/detalhar_ss_os.py) **continua operando de forma 100% independente**.
* Ele pode rodar localmente no computador do operador ou em um contêiner auxiliar com Firefox headless dentro da rede da Embasa.
* O robô consulta as ordens concluídas que ainda não possuem detalhes no banco, navega na tela `dose.xhtml` do SCI Web, raspa a página completa com BeautifulSoup e envia o lote estruturado para a API do Gestão UMB.

Desta forma, a operação **nunca fica desassistida**: se a TI fornecer a view direta, ganha-se velocidade máxima; se não fornecer, o robô garante a integridade dos dados de campo e da auditoria do POP 01.
