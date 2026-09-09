# Especificação de Integração de Dados

## 1. Endereço do Webhook (Endpoint)

As cargas unificadas de dados de ordens de serviço devem ser enviadas via requisição HTTP do tipo POST:

* URL do Webhook: http://10.19.148.24:3002/webhook  (ip local)
* Método HTTP: POST
* Headers: Content-Type: application/json ou Content-Type: text/csv

---

## 2. Estrutura de Campos do Payload de Envio

O envio unificado aceita arquivos CSV (delimitados por `;`) ou arrays JSON. A lista abaixo define as colunas e as respectivas chaves JSON esperadas pelo sistema:

1. SS (Chave JSON: ss | Texto, Obrigatório)
   * Número identificador da Solicitação de Serviço / OS (ex: "2026123456").
2. Serviço (Chave JSON: servico | Texto, Obrigatório)
   * Código e descrição do serviço solicitado (ex: "364 - VERIF FALTA AGUA IMOVEL").
3. Matrícula (Chave JSON: matricula | Texto, Recomendado)
   * Número de matrícula do cliente (ex: "54321098").
4. Localidade (Chave JSON: localidade | Texto, Obrigatório)
   * Código e nome da localidade operacional (ex: "101 - SALVADOR").
5. Bairro (Chave JSON: bairro | Texto, Obrigatório)
   * Código e nome do bairro (ex: "18 - ITAPUA").
6. Logradouro (Chave JSON: logradouro | Texto, Obrigatório)
   * Nome da rua/avenida (ex: "AVENIDA DORIVAL CAYMMI").
7. Nº do Imóvel (Chave JSON: num_imovel | Texto, Recomendado)
   * Número do imóvel ou CEP (ex: "41700-000").
8. Dt Abertura da SS (Chave JSON: data_abertura | Texto, Obrigatório)
   * Data/Hora de abertura da solicitação. Formato: DD/MM/YYYY HH:MM:SS (ex: "18/08/2026 08:30:00").
9. Conclusão da SS (Chave JSON: data_conclusao | Texto, Condicional)
   * Data/Hora de execução da OS. Formato: DD/MM/YYYY HH:MM:SS (obrigatório para ordens com status concluído).
10. Obs da SS (Chave JSON: especificacao | Texto, Obrigatório)
    * Descrição ou observação inicial do chamado no momento da abertura (ex: "Sem água na torneira da pia").
11. Obs de Enc da OS (Chave JSON: observacao | Texto, Obrigatório)
    * Observações técnicas e encerramento preenchidos pelas equipes de campo na conclusão da OS.
12. Sit da OS (Chave JSON: situacao | Texto, Obrigatório)
    * Status atual da ordem (ex: "Aberta", "Programada", "Concluída Executada", "Concluída Não Executada").
13. Unid Atual (OS) (Chave JSON: unidade_atual | Texto, Recomendado)
    * Sigla ou nome do setor atualmente encarregado pela OS (ex: "US-ITAPUA").
14. Data/Hora Última Tramitação da OS (Chave JSON: data_tramitacao | Texto, Recomendado)
    * Data da última movimentação ou atualização da OS (ex: "18/08/2026").

---

## 3. Filtro de Serviços Utilizados na View

A view de extração deve ser restrita apenas aos seguintes códigos de serviços monitorados:

```sql
WHERE (codigo_servico IN (
    -- A. Falta d'Água (Pendentes e Concluídas)
    '364',  -- VERIF FALTA AGUA IMOVEL
    
    -- B. Vazamentos (Rede, Ramal ou Hidrômetro)
    '290',  -- VAZAMENTO NO HIDROMETRO
    '291',  -- VAZ RAMAL NA RUA COM PAVI
    '292',  -- VAZ RAMAL NA RUA SEM PAVI
    '318',  -- VAZ REDE PASSEIO C/PAVIM
    '320',  -- VAZ REDE NA RUA C/PAVIMEN
    
    -- C. Reposição de Pavimento
    '85',   -- RECOMPOS PAVIM PASSEIO
    '160',  -- RECOMP PAV ASFALTICO
    '86',   -- RECOMPOSICAO PAVIMENT RUA
    
    -- D. Abastecimento Alternativo (Carro Pipa)
    '273',  -- CARRO PIPA DESABASTECIMEN
    '1017'  -- CARRO PIPA DEMANDA OPERACIONAL
) OR descricao_servico LIKE '%FALTA AGUA%' 
  OR descricao_servico LIKE '%VAZAMENTO%' 
  OR descricao_servico LIKE '%RECOMPOSICAO PAVIMENT%' 
  OR descricao_servico LIKE '%CARRO PIPA%')
```

---

## 4. Exemplos de Payload de Transmissão

### Opção A: JSON (Content-Type: application/json)
```json
[
  {
    "ss": "2026887711",
    "servico": "364 - VERIF FALTA AGUA IMOVEL",
    "matricula": "99882233",
    "localidade": "101 - SALVADOR",
    "bairro": "18 - ITAPUA",
    "logradouro": "RUA DA ALVORADA",
    "num_imovel": "41500-000",
    "data_abertura": "18/08/2026 08:30:00",
    "data_conclusao": "",
    "especificacao": "Morador alega falta de agua ha 3 dias no bloco B.",
    "observacao": "",
    "situacao": "Aberta",
    "unidade_atual": "US-ITAPUA",
    "data_tramitacao": "18/08/2026"
  },
  {
    "ss": "2026887712",
    "servico": "364 - VERIF FALTA AGUA IMOVEL",
    "matricula": "11223344",
    "localidade": "101 - SALVADOR",
    "bairro": "17 - PIATA",
    "logradouro": "RUA DOS COQUEIROS",
    "num_imovel": "120",
    "data_abertura": "18/08/2026 09:15:00",
    "data_conclusao": "18/08/2026 12:45:00",
    "especificacao": "Solicita verificacao de falta de agua.",
    "observacao": "Abastecimento normalizado pela equipe de campo.",
    "situacao": "Concluída Executada",
    "unidade_atual": "US-ITAPUA",
    "data_tramitacao": "18/08/2026"
  }
]
```

### Opção B: CSV (Content-Type: text/csv)
```csv
SS;Serviço;Matrícula;Localidade;Bairro;Logradouro;Nº do Imóvel;Dt Abertura da SS;Conclusão da SS;Obs da SS;Obs de Enc da OS;Sit da OS;Unid Atual (OS);Data/Hora Última Tramitação da OS
2026887711;364 - VERIF FALTA AGUA IMOVEL;99882233;101 - SALVADOR;18 - ITAPUA;RUA DA ALVORADA;41500-000;18/08/2026 08:30:00;;Morador alega falta de agua ha 3 dias no bloco B.;;Aberta;US-ITAPUA;18/08/2026
2026887712;364 - VERIF FALTA AGUA IMOVEL;11223344;101 - SALVADOR;17 - PIATA;RUA DOS COQUEIROS;120;18/08/2026 09:15:00;18/08/2026 12:45:00;Solicita verificacao de falta de agua.;Abastecimento normalizado pela equipe de campo.;Concluída Executada;US-ITAPUA;18/08/2026
```
