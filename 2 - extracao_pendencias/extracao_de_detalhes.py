import os
import sys
import glob
import requests
import re
from bs4 import BeautifulSoup

# Adiciona o diretório dos scripts ao sys.path se necessário
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def extrair_por_label(soup, label_text, is_input=False, is_textarea=False):
    """Busca o elemento pelo texto da label (aproximado) e extrai o valor."""
    
    # Busca todas as tags que contêm o texto
    elements = soup.find_all(lambda tag: tag.name in ['label', 'span', 'td', 'th', 'div'] and tag.string and label_text.lower() in tag.string.lower())
    
    # Filtrar para pegar o elemento mais "profundo" (que tem o texto exato ou mais próximo)
    if not elements:
        # Fallback para get_text se string for None
        elements = soup.find_all(lambda tag: tag.name in ['label', 'span', 'td', 'th'] and label_text.lower() in tag.get_text().lower())
        if not elements:
            return ""

    # Ordenar por tamanho do texto para pegar o match mais exato
    elements.sort(key=lambda e: len(e.get_text(strip=True)))
    element = elements[0]

    # Estrutura 1: Tabela clássica (td -> td)
    parent_td = element.find_parent(['td', 'th'])
    if parent_td:
        next_td = parent_td.find_next_sibling('td')
        if next_td:
            input_field = next_td.find(['input', 'textarea'])
            if input_field:
                val = input_field.get('value', '').strip() or input_field.get_text(strip=True)
                if val: return val
            select_field = next_td.find('select')
            if select_field:
                selected = select_field.find('option', selected=True)
                if selected: return selected.get_text(strip=True)
            return next_td.get_text(strip=True)

    # Estrutura 2: span.cc-item-label -> span.cc-item-component
    parent_cc = element.find_parent('span', class_='cc-item-label')
    if parent_cc:
        next_cc = parent_cc.find_next_sibling('span', class_='cc-item-component')
        if next_cc:
            input_field = next_cc.find(['input', 'textarea'])
            if input_field:
                val = input_field.get('value', '').strip() or input_field.get_text(strip=True)
                if val: return val
            select_field = next_cc.find('select')
            if select_field:
                selected = select_field.find('option', selected=True)
                if selected: return selected.get_text(strip=True)
            return next_cc.get_text(strip=True)

    # Estrutura 3: label/span -> input
    curr = element
    while curr:
        next_node = curr.find_next_sibling()
        if next_node:
            input_field = next_node if next_node.name in ['input', 'textarea'] else next_node.find(['input', 'textarea'])
            if input_field:
                val = input_field.get('value', '').strip() or input_field.get_text(strip=True)
                if val: return val
            select_field = next_node if next_node.name == 'select' else next_node.find('select')
            if select_field:
                selected = select_field.find('option', selected=True)
                if selected: return selected.get_text(strip=True)
            text_val = next_node.get_text(strip=True)
            if text_val: return text_val
        curr = curr.parent

    return ""

def processar_htmls(pasta_htmls=r"dados_brutos\detalhes_ss_os"):
    print(f"Buscando HTMLs na pasta {pasta_htmls}...")
    arquivos = glob.glob(os.path.join(pasta_htmls, "*.html"))
    if not arquivos:
        print("Nenhum HTML encontrado para processar.")
        return

    detalhes = []
    
    for arq in arquivos:
        nome_arquivo = os.path.basename(arq)
        # Extrair SS e OS do nome do arquivo (detalhe_ss_XXXX_os_YYYY.html ou detalhe_ss_XXXX.html)
        partes = nome_arquivo.replace(".html", "").split("_")
        ss_val = ""
        os_val = ""
        if "ss" in partes:
            idx = partes.index("ss")
            ss_val = partes[idx+1]
        if "os" in partes:
            idx = partes.index("os")
            os_val = partes[idx+1]
            
        try:
            with open(arq, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f.read(), 'html.parser')

            # --- DADOS DA EXECUÇÃO E ENCERRAMENTO ---
            equipe = extrair_por_label(soup, "Equipe executora")
            if not equipe: equipe = extrair_por_label(soup, "Equipe")
            horas_exec = extrair_por_label(soup, "Horas em Execução")
            horas_atend = extrair_por_label(soup, "Horas em Atendimento")

            # --- DADOS DO HD ---
            hd_leitura = extrair_por_label(soup, "Leitura do HD")
            hd_numero = extrair_por_label(soup, "Número do HD")
            hd_pressao = extrair_por_label(soup, "Pressão do HD")

            # --- DADOS DO IMÓVEL ---
            pavimentos = extrair_por_label(soup, "Qtd de Pavimentos") or "Não informado"
            situacao_imovel = extrair_por_label(soup, "Situação do Imóvel") or "Não informado"
            res_inf = extrair_por_label(soup, "Reservatório Inferior") or "Não informado"
            res_sup = extrair_por_label(soup, "Reservatório Superior") or "Não informado"

            # --- DADOS DA LIGAÇÃO ---
            lacre = extrair_por_label(soup, "Cor do lacre")
            sit_ligacao = extrair_por_label(soup, "Situação da ligação")

            # --- DADOS DO SERVIÇO (Lados) ---
            hd_dir = extrair_por_label(soup, "HD lado direito")
            hd_dir_leit = extrair_por_label(soup, "Leitura HD direito")
            hd_dir_pres = extrair_por_label(soup, "Pressão HD direito")
            
            hd_esq = extrair_por_label(soup, "HD lado esquerdo")
            hd_esq_leit = extrair_por_label(soup, "Leitura HD esquerdo")
            hd_esq_pres = extrair_por_label(soup, "Pressão HD esquerdo")

            sit_abast = extrair_por_label(soup, "Sit abast após exec")
            desob = extrair_por_label(soup, "Necessidade de Desob")
            gerar_desob = extrair_por_label(soup, "Deseja gerar desobstrução")
            
            if desob and "sim" in desob.lower():
                # Removida a substituição forçada, para manter o que o usuário respondeu de verdade.
                pass

            # --- SOLICITAÇÕES COMPLEMENTARES ---
            sec_ss = ""
            sec_tipo = ""
            texto_html = soup.get_text()
            m_sec = re.search(r'Solicitações Complementares.*?Solicitação:?\s*(\d+).*?Tipo:?\s*([^\n\r]+)', texto_html, re.IGNORECASE | re.DOTALL)
            if m_sec:
                sec_ss = m_sec.group(1).strip()
                sec_tipo = m_sec.group(2).strip()

            motivo = extrair_por_label(soup, "Motivo da Falta")
            referencia = extrair_por_label(soup, "Ponto de Referência")
            usuario_presente = extrair_por_label(soup, "Usuário Presente")

            # --- MATERIAL ---
            material = extrair_por_label(soup, "Material Utilizado")

            # --- OBSERVAÇÃO ---
            obs_enc = extrair_por_label(soup, "Observação do Encerramento", is_textarea=True)

            # --- DOCUMENTOS (Fotos/Anexos) ---
            qtd_docs = 0
            
            # Busca direta no texto puro do HTML para padrões como "Documentos 8 / 12" -> queremos o 12
            texto_html = soup.get_text()
            m = re.search(r'Documentos\s+\d+\s*/\s*(\d+)', texto_html, re.IGNORECASE)
            if m:
                qtd_docs = int(m.group(1))
            else:
                # Fallback para buscar a label clássica "Documentos:" -> "8 / 12"
                m2 = re.search(r'Documentos\s*(?:[:\-])?\s*\d+\s*/\s*(\d+)', texto_html, re.IGNORECASE)
                if m2:
                    qtd_docs = int(m2.group(1))
                else:
                    # Fallback para contar as tr
                    tabela_docs = soup.find(id="form-j_idt407-tb")
                    if not tabela_docs:
                        tabelas = soup.find_all("tbody", class_="ui-datatable-data")
                        for tb in tabelas:
                            if "documento" in str(tb).lower() or "anexo" in str(tb).lower() or len(tb.find_all("tr")) > 0:
                                qtd_docs = max(qtd_docs, len(tb.find_all("tr", class_="ui-widget-content")))

            status_docs = "Insuficiente" if qtd_docs < 3 else "OK"

            # Se a OS tiver vazia (não mapeou direito no nome), tentar pegar do HTML
            if not os_val:
                elem_os = soup.find(id="form-j_idt70-j_idt79-item")
                if elem_os: os_val = elem_os.get('value', '').strip()

            item = {
                "numero_os": ss_val, # O ss_val do arquivo agora contém a verdadeira OS (10 dígitos)
                "equipe_executora": equipe or "Equipe N/I",
                "horas_execucao": horas_exec,
                "horas_atendimento": horas_atend,
                "hd_leitura": hd_leitura,
                "hd_numero": hd_numero,
                "hd_pressao": hd_pressao,
                "imovel_pavimentos": pavimentos,
                "imovel_situacao": situacao_imovel,
                "imovel_res_inf": res_inf,
                "imovel_res_sup": res_sup,
                "ligacao_lacre_cor": lacre,
                "ligacao_situacao": sit_ligacao,
                "hd_lado_direito": hd_dir,
                "hd_lado_direito_leitura": hd_dir_leit,
                "hd_lado_direito_pressao": hd_dir_pres,
                "hd_lado_esquerdo": hd_esq,
                "hd_lado_esquerdo_leitura": hd_esq_leit,
                "hd_lado_esquerdo_pressao": hd_esq_pres,
                "sit_abast_apos_exec": sit_abast,
                "necessidade_desob_ramal": desob,
                "deseja_gerar_desobstrucao": gerar_desob,
                "motivo_falta_dagua": motivo,
                "ponto_referencia": referencia,
                "usuario_presente": usuario_presente,
                "material_utilizado": material,
                "obs_encerramento": obs_enc,
                "qtd_documentos": qtd_docs,
                "status_documentos": status_docs,
                "sec_ss": sec_ss,
                "sec_tipo": sec_tipo
            }
            detalhes.append(item)
            
            
            # Não removemos o arquivo aqui ainda. Apenas após enviar ao DB com sucesso.
            

        except Exception as e:
            print(f"Erro ao analisar {arq}: {e}")

    if detalhes:
        print(f"Enviando {len(detalhes)} registros estruturados para o Backend (em lotes)...")
        try:
            lote_size = 30
            for i in range(0, len(detalhes), lote_size):
                lote = detalhes[i:i + lote_size]
                lote_arquivos = arquivos[i:i + lote_size]
                
                resp = requests.post("http://localhost:3001/api/detalhes_os/bulk", json=lote)
                resp.raise_for_status()
                
                # Remove os HTMLs processados deste lote
                for arq in lote_arquivos:
                    try: os.remove(arq)
                    except: pass
            
            print("[OK] Todos os detalhes inseridos no banco com sucesso!")
                
        except Exception as err:
            print(f"Erro ao enviar dados para a API: {err}")

if __name__ == "__main__":
    processar_htmls()
