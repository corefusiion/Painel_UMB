import time
import os
import glob
from datetime import datetime, timedelta
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.firefox import GeckoDriverManager
import pandas as pd

# Carregar variáveis de ambiente do .env na pasta do projeto
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(ENV_PATH)

SCI_USER = os.getenv("SCI_USER")
SCI_PASSWORD = os.getenv("SCI_PASSWORD")
SYSTEM_URL = "https://sciweb.embasanet.ba.gov.br/sci-web/index.xhtml"
CONSULTA_URL = "https://sciweb.embasanet.ba.gov.br/sci-web/modulo/atendimento/acompanhamento/crss.xhtml"

# IDs Mapeados do Sistema SCI Web
ID_DT_INICIAL = "form-filtroAcss-dataId-dataTipo-beginDate"
ID_DT_FINAL = "form-filtroAcss-dataId-dataTipo-endDate"
ID_FILTRO_USUARIO = "form-filtroAcss-dlgFilterPrefs-tableUser-7-j_idt364"
ID_BTN_CSV = "form-grid-grid-exportCSVBtn-j_idt848"
ID_NEXT_PAGE = "form-grid-grid-j_idt860-nextPage"

# Pasta de Destino para os downloads de Falta d'Água Executadas
DOWNLOAD_DIR = r"C:\Users\t034183\Desktop\UMBMAS\2 - extracao_pendencias\dados\Falta_dagua_ex"

def get_firefox_driver(download_folder, retries=3, headless=True):
    """Configura o navegador Mozilla Firefox para downloads automáticos com retry."""
    os.makedirs(download_folder, exist_ok=True)
    
    options = Options()
    if headless:
        options.add_argument("--headless")
    options.set_preference("browser.download.folderList", 2)
    options.set_preference("browser.download.dir", download_folder)
    options.set_preference("browser.download.useDownloadDir", True)
    options.set_preference("browser.helperApps.neverAsk.saveToDisk", "text/csv,application/csv,application/vnd.ms-excel,text/plain")
    
    for attempt in range(retries):
        try:
            service = Service(GeckoDriverManager().install())
            driver = webdriver.Firefox(service=service, options=options)
            time.sleep(2)
            try: driver.maximize_window()
            except: pass
            
            # Testa a comunicação com a janela
            driver.current_url
            return driver
        except Exception as e:
            print(f"Erro ao iniciar driver (Tentativa {attempt+1}/{retries}): {e}")
            try: driver.quit()
            except: pass
            time.sleep(3)
            
    raise Exception("Falha ao iniciar Mozilla Firefox após várias tentativas.")

def login(driver):
    """Realiza autenticação no SCI Web com as credenciais do arquivo .env."""
    if not SCI_USER or not SCI_PASSWORD:
        raise ValueError("Credenciais SCI_USER / SCI_PASSWORD não encontradas no arquivo .env!")
        
    print(f"Navegando para tela de login ({SYSTEM_URL})...")
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
        print("✓ Login realizado com sucesso.")
    except Exception as e:
        print(f"Erro durante o login: {e}")
        raise

def aguardar_download(download_dir, timeout=60):
    """Aguardar a conclusão do download do arquivo na pasta especificada."""
    seconds = 0
    while seconds < timeout:
        in_progress = glob.glob(os.path.join(download_dir, "*.crdownload")) + \
                      glob.glob(os.path.join(download_dir, "*.tmp")) + \
                      glob.glob(os.path.join(download_dir, "*.part"))
        
        csv_files = glob.glob(os.path.join(download_dir, "*.csv"))
        
        # Se tem arquivo em progresso, continua esperando
        if in_progress:
            pass
        # Se não tem em progresso e já existe algum csv, então terminou!
        elif csv_files:
            time.sleep(2)  # Extra margem de segurança
            return True
            
        time.sleep(1)
        seconds += 1
        
    return False

def extrair_falta_dagua_ex(driver, str_inicio=None, str_fim=None):
    """Executa a extração do filtro 7 de Falta d'Água Executadas considerando o período informado."""
    print("\nIniciando extração de Falta d'Água Executadas...")
    wait = WebDriverWait(driver, 15)
    
    if not str_fim:
        str_fim = datetime.now().strftime('%d/%m/%Y')
    if not str_inicio:
        str_inicio = (datetime.now() - timedelta(days=1)).strftime('%d/%m/%Y')
    
    print(f"--- Período de Análise: {str_inicio} até {str_fim} ---")
    
    driver.get(CONSULTA_URL)
    time.sleep(3)
    
    # 1. Abrir preferências de filtro
    print("Abrindo preferências de filtro...")
    btn_prefs = wait.until(EC.element_to_be_clickable((By.ID, "form-filtroAcss-btnOpenDlgPrefs")))
    driver.execute_script("arguments[0].click();", btn_prefs)
    time.sleep(1.5)
    
    # 2. Selecionar o Filtro 7 do Usuário
    print(f"Selecionando filtro de usuário ({ID_FILTRO_USUARIO})...")
    btn_user_pref = wait.until(EC.presence_of_element_located((By.ID, ID_FILTRO_USUARIO)))
    driver.execute_script("arguments[0].click();", btn_user_pref)
    time.sleep(2)
    
    # 3. Preencher Datas de Início e Fim (Intervalo de 2 dias)
    print(f"Preenchendo intervalo de datas ({str_inicio} - {str_fim})...")
    campo_ini = wait.until(EC.presence_of_element_located((By.ID, ID_DT_INICIAL)))
    campo_ini.clear()
    campo_ini.send_keys(str_inicio)
    
    campo_fim = driver.find_element(By.ID, ID_DT_FINAL)
    campo_fim.clear()
    campo_fim.send_keys(str_fim)
    
    # 4. Clicar em Pesquisar
    print("Aplicando filtro e pesquisando no SCI Web...")
    btn_search = wait.until(EC.element_to_be_clickable((By.ID, "form-filtroAcss-toolbox-btn-search")))
    driver.execute_script("arguments[0].click();", btn_search)
    time.sleep(5)
    
    # 5. Iteração pelas Páginas (Página 1, Página 2...) com Exportação CSV
    pagina_atual = 1
    
    while True:
        print(f"\n---> Processando Página {pagina_atual}...")
        
        # Solicitando o download do modelo CSV
        try:
            print("Solicitando download do arquivo CSV...")
            btn_csv = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, ID_BTN_CSV))
            )
            driver.execute_script("arguments[0].click();", btn_csv)
        except Exception:
            try:
                btn_csv = driver.find_element(By.CSS_SELECTOR, "a.icon-csv, a[onclick*='exportCSVBtn']")
                driver.execute_script("arguments[0].click();", btn_csv)
            except Exception as err:
                print(f"Erro ao localizar/clicar no botão CSV da página {pagina_atual}: {err}")
                break
                
        # Aguardar download terminar
        aguardar_download(DOWNLOAD_DIR, timeout=30)
        print(f"✓ Download da Página {pagina_atual} concluído.")
        
        # Paginação desativada conforme solicitado (o download do CSV já baixa a busca completa)
        print("✓ Download do CSV concluído. Paginação desativada para maior agilidade.")
        break

    # 6. Deduplicação e Consolidação dos CSVs
    consolidar_e_deduplicar_csvs(DOWNLOAD_DIR)

def consolidar_e_deduplicar_csvs(folder_path):
    """Consolida múltiplos CSVs baixados e remove registros duplicados por SS/OS."""
    print("\nIniciando análise e deduplicação dos arquivos CSV...")
    csv_files = glob.glob(os.path.join(folder_path, "*.csv"))
    
    if not csv_files:
        print("Nenhum arquivo CSV encontrado para processamento.")
        return

    dfs = []
    for f in csv_files:
        if "consolidado" in f:
            continue
        try:
            df = pd.read_csv(f, sep=';', encoding='latin1', dtype=str)
            dfs.append(df)
        except Exception:
            try:
                df = pd.read_csv(f, sep=',', encoding='utf-8', dtype=str)
                dfs.append(df)
            except Exception as e:
                print(f"Erro ao ler o arquivo CSV {f}: {e}")

    if not dfs:
        print("Nenhum dado válido extraído dos arquivos.")
        return

    df_total = pd.concat(dfs, ignore_index=True)
    total_antes = len(df_total)
    
    # Identificar coluna de SS / OS para deduplicação
    col_chave = None
    for col in df_total.columns:
        col_clean = col.strip().lower()
        if col_clean in ['ss', 'os', 'numero_os', 'ordem_servico', 'ordem de servico']:
            col_chave = col
            break
            
    if col_chave:
        df_total.drop_duplicates(subset=[col_chave], inplace=True)
        print(f"✓ Deduplicação executada pela coluna chave '{col_chave}'.")
    else:
        df_total.drop_duplicates(inplace=True)
        print("✓ Deduplicação executada considerando todas as colunas.")

    total_depois = len(df_total)
    print(f"✓ Total antes: {total_antes} registros | Total após deduplicação: {total_depois} registros ({total_antes - total_depois} duplicatas removidas).")

    output_file = os.path.join(folder_path, "falta_dagua_ex_consolidado.csv")
    df_total.to_csv(output_file, index=False, sep=';', encoding='utf-8-sig')
    print(f"✓ Arquivo consolidado salvo em:\n  {output_file}")

    # 7. Sincronizar com Projeto 3 (Saneaia Machine Learning) PRIMEIRO (antes dos CSVs serem limpos pelo upload)
    try:
        import shutil
        import sys
        saneaia_entrada = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "3 - Saneaia", "dados_entrada"))
        if os.path.exists(saneaia_entrada):
            dest_file = os.path.join(saneaia_entrada, "falta_dagua_ex_consolidado.csv")
            shutil.copy(output_file, dest_file)
            print(f"\n[PROJETO 3] ✓ Copiado para a entrada da IA em: {dest_file}")
            
            saneaia_dir = os.path.dirname(saneaia_entrada)
            if saneaia_dir not in sys.path:
                sys.path.append(saneaia_dir)
            from database.import_data import import_file
            import_file(dest_file)
            print("[PROJETO 3] ✓ Banco de dados da IA (Saneaia) atualizado com sucesso!")
    except Exception as e:
        print(f"Aviso ao integrar com o Projeto 3 (Saneaia): {e}")

    # 8. Sincronizar com Projeto 1 (Painel Gestão UMB)
    try:
        import upload_supabase
        print("\n[PROJETO 1] Enviando dados ao Backend Express (Painel UMB)...")
        upload_supabase.upload_executadas_only()
    except Exception as e:
        print(f"Aviso ao enviar ao Projeto 1: {e}")

def main(str_inicio=None, str_fim=None, headless=True):
    print("==================================================")
    print(f" SCI WEB - Extração Falta d'Água Executadas (Mozilla Firefox Headless={headless})")
    print("==================================================")
    
    # Garantir existência da pasta de download e limpar arquivos antigos
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    for f in glob.glob(os.path.join(DOWNLOAD_DIR, "*.csv")):
        try: os.remove(f)
        except: pass
    
    driver = None
    try:
        driver = get_firefox_driver(DOWNLOAD_DIR, headless=headless)
        login(driver)
        time.sleep(2)
        extrair_falta_dagua_ex(driver, str_inicio, str_fim)
    except Exception as e:
        print(f"\n❌ Ocorreu um erro durante a execução: {e}")
    finally:
        if driver:
            print("\nEncerrando o navegador Mozilla Firefox...")
            time.sleep(5)
            driver.quit()
            print("Driver finalizado com sucesso.")

if __name__ == "__main__":
    main()
