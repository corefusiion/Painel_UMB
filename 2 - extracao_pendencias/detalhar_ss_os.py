import time
import os
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import requests
import pandas as pd
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.webdriver import WebDriver
from selenium import webdriver
from webdriver_manager.firefox import GeckoDriverManager
from dotenv import load_dotenv

# Carregar variáveis de ambiente do .env local ou da raiz do projeto
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
ROOT_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)
if os.path.exists(ROOT_ENV_PATH):
    load_dotenv(ROOT_ENV_PATH)

SCI_USER = os.getenv("SCI_USER")
SCI_PASSWORD = os.getenv("SCI_PASSWORD")
SYSTEM_URL = "https://sciweb.embasanet.ba.gov.br/sci-web/index.xhtml"

def get_driver(download_folder_name, retries=3, headless=True):
    """Configura o navegador Mozilla Firefox com tentativas em caso de crash."""
    caminho_absoluto = os.path.abspath(download_folder_name)
    os.makedirs(caminho_absoluto, exist_ok=True)
    
    options = Options()
    if headless:
        options.add_argument("--headless")
    options.set_preference("browser.download.folderList", 2)
    options.set_preference("browser.download.dir", caminho_absoluto)
    options.set_preference("browser.download.useDownloadDir", True)
    options.set_preference("browser.helperApps.neverAsk.saveToDisk", "text/html")
    
    for attempt in range(retries):
        try:
            service = Service(GeckoDriverManager().install())
            driver = webdriver.Firefox(service=service, options=options)
            time.sleep(2)
            try:
                driver.maximize_window()
            except Exception as e:
                print(f"Aviso: Não foi possível maximizar a janela ({e})")
            
            # Testa se o browser responde
            driver.current_url
            return driver
        except Exception as err:
            print(f"Erro ao iniciar o driver (Tentativa {attempt+1}/{retries}): {err}")
            try: driver.quit()
            except: pass
            time.sleep(3)
            
    raise Exception("Falha definitiva ao iniciar o Mozilla Firefox após várias tentativas.")

URL_DOSE = "https://sciweb.embasanet.ba.gov.br/sci-web/modulo/atendimento/acompanhamento/dose.xhtml"

# IDs Mapeados
ID_CAMPO_SS = "form-j_idt70-j_idt71-item"
ID_CAMPO_OS = "form-j_idt70-j_idt79-item"
ID_BOTAO_PESQUISAR = "form-j_idt70-j_idt90"
ID_VALIDACAO_SS = "form-j_idt128-j_idt137"

def login(driver):
    """Efetua login no sistema SCI Web."""
    print(f"Navegando para a página de login: {SYSTEM_URL}...")
    driver.get(SYSTEM_URL)
    time.sleep(2)
    
    try:
        random_tag_element = driver.find_element(By.ID, "random-tag")
        random_value = random_tag_element.get_attribute("value")
        
        user_id = f"loginForm-usuario-{random_value}"
        password_id = f"loginForm-senha-{random_value}"
        
        driver.find_element(By.ID, user_id).send_keys(SCI_USER)
        driver.find_element(By.ID, password_id).send_keys(SCI_PASSWORD)
        driver.find_element(By.ID, "loginForm-submit").click()
        print("Login executado com sucesso.")
    except Exception as e:
        print(f"Erro durante o login: {e}")
        raise e

def consultar_e_extrair_ss_os(driver, numero_ss, numero_os=""):
    """
    Acessa a página dose.xhtml, preenche os campos SS e OS, clica no botão de pesquisa,
    valida o resultado obtido e extrai a página via BeautifulSoup.
    """
    print(f"\n--- Iniciando consulta para SS: '{numero_ss}' | OS: '{numero_os}' ---")
    
    wait = WebDriverWait(driver, 15)
    
    # 1. Navegar para a página DOSE
    print(f"Navegando para: {URL_DOSE}...")
    driver.get(URL_DOSE)
    time.sleep(2)
    
    # 2. Preencher campo SS
    print(f"Preenchendo campo de SS ({ID_CAMPO_SS})...")
    campo_ss = wait.until(EC.element_to_be_clickable((By.ID, ID_CAMPO_SS)))
    driver.execute_script("arguments[0].value = '';", campo_ss)
    time.sleep(0.5)
    campo_ss.clear()
    campo_ss.send_keys(str(numero_ss))
    
    # 3. Preencher campo OS (opcional)
    if numero_os:
        print(f"Preenchendo campo de OS ({ID_CAMPO_OS})...")
        campo_os = driver.find_element(By.ID, ID_CAMPO_OS)
        driver.execute_script("arguments[0].value = '';", campo_os)
        campo_os.clear()
        campo_os.send_keys(str(numero_os))
        
    # 4. Executar Pesquisa via Keys.ENTER no campo
    print(f"Submetendo pesquisa com ENTER no campo de SS...")
    try:
        if numero_os:
            campo_os = driver.find_element(By.ID, ID_CAMPO_OS)
            campo_os.send_keys(Keys.ENTER)
        else:
            campo_ss.send_keys(Keys.ENTER)
        print("Pesquisa submetida via Keys.ENTER com sucesso.")
    except Exception as ex_enter:
        print(f"Aviso ao enviar ENTER: {ex_enter}. Tentando clique no botão {ID_BOTAO_PESQUISAR}...")
        try:
            btn_pesquisar = wait.until(EC.presence_of_element_located((By.ID, ID_BOTAO_PESQUISAR)))
            driver.execute_script("arguments[0].click();", btn_pesquisar)
        except Exception as ex_btn:
            print(f"Erro ao clicar no botão de pesquisa: {ex_btn}")

    time.sleep(4)
    
    # 5. Validação da SS exibida
    print("Validando resultado exibido...")
    ss_encontrada = None
    valida_sucesso = False
    
    try:
        elem_validacao = wait.until(EC.presence_of_element_located((By.ID, ID_VALIDACAO_SS)))
        ss_encontrada = elem_validacao.text.strip()
        print(f"Valor retornado no campo de validação ({ID_VALIDACAO_SS}): '{ss_encontrada}'")
        
        if str(numero_ss).strip() in ss_encontrada:
            valida_sucesso = True
            print("[OK] VALIDACAO SUCESSO: A SS exibida corresponde a SS pesquisada.")
        else:
            print(f"[AVISO] AVISO DE VALIDACAO: SS pesquisada '{numero_ss}' difere de '{ss_encontrada}'.")
    except TimeoutException:
        print(f"[ERRO] Elemento de validacao ({ID_VALIDACAO_SS}) nao encontrado apos a pesquisa.")
    except Exception as e:
        print(f"Erro na validacao da SS: {e}")

    # 6. Extração da página HTML com BeautifulSoup
    print("Refletindo propriedades JS para atributos HTML...")
    script_fix = """
    let inputs = document.querySelectorAll('input, textarea, select');
    for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].tagName === 'SELECT') {
            if(inputs[i].selectedIndex >= 0) {
                inputs[i].options[inputs[i].selectedIndex].setAttribute('selected', 'selected');
            }
        } else {
            inputs[i].setAttribute('value', inputs[i].value);
            if (inputs[i].tagName === 'TEXTAREA') {
                inputs[i].innerHTML = inputs[i].value;
            }
        }
    }
    """
    try:
        driver.execute_script(script_fix)
        time.sleep(0.5)
    except Exception as e:
        print(f"Aviso ao executar script_fix: {e}")

    print("Extraindo conteudo da pagina com BeautifulSoup...")
    html_content = driver.page_source
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Salvar em pasta de resultados
    pasta_saida = os.path.join("dados_brutos", "detalhes_ss_os")
    os.makedirs(pasta_saida, exist_ok=True)
    
    if numero_os:
        nome_arquivo = f"detalhe_ss_{numero_ss}_os_{numero_os}.html"
    else:
        nome_arquivo = f"detalhe_ss_{numero_ss}.html"
        
    caminho_arquivo = os.path.join(pasta_saida, nome_arquivo)
    
    with open(caminho_arquivo, 'w', encoding='utf-8') as f:
        f.write(soup.prettify())
        
    print(f"[PAGINA] Pagina HTML extraida e salva em: {caminho_arquivo}")
    
    return {
        "valido": valida_sucesso,
        "ss_pesquisada": numero_ss,
        "ss_retornada": ss_encontrada,
        "caminho_html": caminho_arquivo
    }

def mapear_htmls_locais(pasta_htmls):
    """
    Lê todos os arquivos HTML na pasta e extrai a SS e OS de dentro do conteúdo.
    Retorna um dicionário {(ss, os): caminho_do_arquivo}.
    """
    mapa = {}
    if not os.path.exists(pasta_htmls):
        return mapa
        
    print(f"Lendo HTMLs existentes em {pasta_htmls} para evitar duplicidade de pesquisa...")
    for nome_arq in os.listdir(pasta_htmls):
        if not nome_arq.endswith(".html"):
            continue
        caminho_arq = os.path.join(pasta_htmls, nome_arq)
        try:
            with open(caminho_arq, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f.read(), 'html.parser')
                
                # Buscar SS
                elem_ss = soup.find(id=ID_CAMPO_SS)
                ss_val = elem_ss.get('value', '').strip() if elem_ss else ""
                
                # Buscar OS
                elem_os = soup.find(id=ID_CAMPO_OS)
                os_val = elem_os.get('value', '').strip() if elem_os else ""
                
                if ss_val:
                    mapa[(ss_val, os_val)] = caminho_arq
        except Exception:
            pass
    return mapa

def processar_lote_banco(dt_inicio=None, dt_fim=None, headless=True, cancel_event=None, progress_callback=None):
    """
    Busca no banco (via API do Express ou direto no SQLite) as OSs executadas
    que verdadeiramente ainda não possuem detalhes.
    Evita reprocessar OSs já gravadas em detalhes_os (inclusive aquelas sem equipe / 'Equipe N/I').
    """
    print("Consultando dados do Projeto 1 para identificar SS/OS pendentes de detalhamento...")
    data = []
    try:
        req = requests.get("http://localhost:3001/api/faltadagua_ex", timeout=15)
        req.raise_for_status()
        data = req.json().get("data", [])
    except Exception as e:
        print(f"Aviso na API do Express ({e}). Consultando banco SQLite local diretamente...")
        try:
            import sqlite3
            db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "1 - gestoaumb", "database.sqlite"))
            if os.path.exists(db_path):
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                rows = cur.execute("""
                    SELECT f.*,
                           CASE WHEN d.numero_os IS NOT NULL THEN 1 ELSE 0 END AS possui_detalhes,
                           d.equipe_executora, d.obs_encerramento, d.status_documentos, d.atende_pop
                    FROM faltadagua_ex f
                    LEFT JOIN detalhes_os d ON f.numero_os = d.numero_os
                    WHERE f.servico LIKE '%FALTA%'
                """).fetchall()
                data = [dict(r) for r in rows]
                conn.close()
        except Exception as ex_db:
            print(f"Erro ao consultar SQLite direto: {ex_db}")
            return {"total": 0, "processados": 0, "pulados": 0, "erros": 0}

    # Filtrar apenas registros que REALMENTE não possuem detalhes gravados no banco
    pendentes = []
    for d in data:
        # 1. Se a coluna calculada do banco indica que já possui detalhes, pular!
        if d.get("possui_detalhes") == 1 or d.get("possui_detalhes") is True:
            continue
            
        # 2. Se já possui dados estruturados de encerramento / POP gravados, pular!
        if d.get("status_documentos") or d.get("obs_encerramento") is not None or d.get("atende_pop") is not None:
            continue

        # 3. Se a equipe já estiver preenchida (inclusive 'Equipe N/I' vinda de raspagem anterior), pular!
        eq = d.get("equipe_executora")
        if eq and str(eq).strip() != "":
            continue

        pendentes.append(d)
    
    if not pendentes:
        print("  [OK] Nenhuma nova SS/OS pendente de detalhamento. Todas as ordens já possuem detalhes gravados no banco.")
        return {"total": 0, "processados": 0, "pulados": 0, "erros": 0}

    print(f"Total de registros pendentes a processar: {len(pendentes)}")

    pasta_saida = os.path.join("dados_brutos", "detalhes_ss_os")
    os.makedirs(pasta_saida, exist_ok=True)
    
    mapa_htmls = mapear_htmls_locais(pasta_saida)
    driver = get_driver(download_folder_name=pasta_saida, headless=headless)
    
    processados = 0
    pulas = 0
    erros = 0

    try:
        login(driver)
        time.sleep(3)

        for idx_row, row in enumerate(pendentes):
            if cancel_event and cancel_event.is_set():
                print("[CANCELAMENTO] Interrupção solicitada pelo usuário no detalhamento.")
                break

            ss_val = str(row.get('numero_os', '')).strip() # O DB armazena a SS na coluna numero_os
            os_val = "1" # Conforme instrução, preencher sempre com '1' para evitar erro de OS Inexistente
            
            if not ss_val:
                continue

            if progress_callback:
                progress_callback({
                    "etapa": "Coletando Detalhes das SS",
                    "atual": idx_row + 1,
                    "total": len(pendentes),
                    "ss": ss_val,
                    "concluidas": processados,
                    "erros": erros,
                    "restantes": len(pendentes) - (idx_row + 1)
                })

            if (ss_val, os_val) in mapa_htmls or (ss_val, "1") in mapa_htmls:
                print(f"[PULANDO] SS {ss_val} (OS {os_val}) - Arquivo ja mapeado pelo conteudo.")
                pulas += 1
                continue

            try:
                res = consultar_e_extrair_ss_os(driver, numero_ss=ss_val, numero_os=os_val)
                if res['valido']:
                    processados += 1
                else:
                    erros += 1
                time.sleep(2)
            except Exception as ex:
                print(f"Erro ao processar SS {ss_val}: {ex}")
                erros += 1

        print(f"\n================ RESUMO DO LOTE ================")
        print(f"Total na fila: {len(pendentes)}")
        print(f"Processados novos: {processados}")
        print(f"Já existentes (pulados): {pulas}")
        print(f"Falhas/Avisos: {erros}")
        print(f"=================================================")

    except Exception as e:
        print(f"Erro fatal no processamento em lote: {e}")
    finally:
        print("Encerrando navegador...")
        time.sleep(2)
        try:
            driver.quit()
        except:
            pass

    return {"total": len(pendentes), "processados": processados, "pulados": pulas, "erros": erros}

def main():
    if not SCI_USER:
        print("ERRO: Credenciais não configuradas no arquivo .env (SCI_USER ou SCI_PASSWORD).")
        return

    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        ss_teste = sys.argv[1]
        os_teste = sys.argv[2] if len(sys.argv) > 2 else ""

        print(f"Executando detalhamento individual para SS={ss_teste}...")
        driver = get_driver(download_folder_name=os.path.join("dados_brutos", "detalhes_ss_os"))
        try:
            login(driver)
            resultado = consultar_e_extrair_ss_os(driver, numero_ss=ss_teste, numero_os=os_teste)
            print(f"\nResumo:\n- Validação: {resultado['valido']}\n- Arquivo Salvo: {resultado['caminho_html']}")
        except Exception as e:
            print(f"Erro: {e}")
        finally:
            driver.quit()
    else:
        print(f"Executando detalhamento inteligente em lote via Banco de Dados...")
        processar_lote_banco()

if __name__ == "__main__":
    main()
