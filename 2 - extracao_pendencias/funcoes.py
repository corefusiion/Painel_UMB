from selenium import webdriver
from subprocess import DEVNULL
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.firefox import GeckoDriverManager
from selenium.common.exceptions import TimeoutException, NoSuchElementException, UnexpectedAlertPresentException, ElementNotInteractableException
from selenium.webdriver.firefox.options import Options
from datetime import datetime, timedelta
import time
import os
import shutil
import tempfile
import glob

import threading
from dotenv import load_dotenv

# Carregar variáveis de ambiente do .env na pasta do projeto
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(ENV_PATH)

SCI_USER = os.getenv("SCI_USER")
SCI_PASSWORD = os.getenv("SCI_PASSWORD")

# Variáveis globais para contagem com Lock de concorrência
num_downloads = 0
dedos_extraidos = []
lock = threading.Lock()

def install_driver():
    """Instala o driver uma única vez para evitar condições de corrida."""
    return GeckoDriverManager().install()

def esperar_sumir(driver):
    wait = WebDriverWait(driver, 30)
    element = wait.until(
        EC.invisibility_of_element_located((By.ID, "j_idt24_modal")))

def esperar_clicavel(variavel, driver):
    wait = WebDriverWait(driver, 10)
    wait.until(EC.element_to_be_clickable((By.ID, variavel)))

def abrir_filtro(filtro, driver, max_tentativas=3):
    """
    Abre o diálogo de filtros e seleciona o filtro especificado.
    Inclui retry logic para lidar com múltiplas threads concorrentes.
    """
    for tentativa in range(1, max_tentativas + 1):
        try:
            print(f"[FILTRO] Tentativa {tentativa}/{max_tentativas} para abrir filtro: {filtro}")
            
            # IMPORTANTE: Esperar qualquer modal desaparecer antes de começar
            esperar_sumir(driver)
            time.sleep(1)
            
            # Esperar e clicar no botão de abrir preferências usando JavaScript
            esperar_clicavel("form-filtroAcss-toolbox-btn-search", driver)
            time.sleep(0.5)
            
            # Usar JavaScript para clicar (evita problemas de overlay)
            print(f"[FILTRO] Abrindo diálogo de preferências...")
            btn_prefs = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.ID, "form-filtroAcss-btnOpenDlgPrefs"))
            )
            driver.execute_script("arguments[0].click();", btn_prefs)
            time.sleep(1.5)  # Aguardar diálogo abrir
            
            # Esperar o filtro estar presente e visível
            print(f"[FILTRO] Aguardando filtro {filtro} estar disponível...")
            filtro_element = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.ID, filtro))
            )
            
            # Scroll para garantir visibilidade
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", filtro_element)
            time.sleep(0.5)
            
            # Clicar usando JavaScript (mais confiável)
            driver.execute_script("arguments[0].click();", filtro_element)
            time.sleep(0.5)
            
            print(f"[FILTRO] ✓ Filtro {filtro} selecionado com sucesso")
            return True
            
        except (TimeoutException, NoSuchElementException, ElementNotInteractableException) as e:
            print(f"[FILTRO] ✗ Tentativa {tentativa} falhou: {type(e).__name__}")
            print(f"[FILTRO] Detalhes: {str(e)[:200]}")
            
            if tentativa < max_tentativas:
                delay = tentativa * 3  # Delay incremental: 3s, 6s, 9s
                print(f"[FILTRO] Aguardando {delay}s antes de tentar novamente...")
                time.sleep(delay)
                
                # Tentar fechar qualquer modal que possa estar aberto
                try:
                    driver.execute_script("""
                        var modals = document.querySelectorAll('.ui-widget-overlay, .ui-dialog-mask');
                        modals.forEach(function(modal) { modal.style.display = 'none'; });
                    """)
                except:
                    pass
            else:
                print(f"[FILTRO] ✗ ERRO: Falha após {max_tentativas} tentativas")
                raise

def _clicar_seguro(driver, element_id, wait_timeout=15):
    """
    Clica em um elemento de forma segura:
    1. Aguarda qualquer overlay/modal sumir
    2. Espera o elemento ser clicável (EC)
    3. Rola para o elemento
    4. Tenta click normal; em caso de ElementClickInterceptedError, usa JS click
    """
    from selenium.common.exceptions import ElementClickInterceptedException

    esperar_sumir(driver)
    wait = WebDriverWait(driver, wait_timeout)
    
    # Esperar elemento ser clicável
    el = wait.until(EC.element_to_be_clickable((By.ID, element_id)))
    
    # Rolar para garantir visibilidade
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", el)
    time.sleep(0.4)
    
    # Tentar click nativo; usar JS como fallback!
    try:
        el.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", el)
    
    return el


def _preencher_data(driver, field_id, valor, wait_timeout=15):
    """
    Preenche um campo de data de forma segura usando scroll + JS click + send_keys.
    Aplica clear() via JS para evitar problemas com máscaras de input.
    """
    from selenium.common.exceptions import ElementClickInterceptedException

    esperar_sumir(driver)
    wait = WebDriverWait(driver, wait_timeout)
    
    el = wait.until(EC.element_to_be_clickable((By.ID, field_id)))
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", el)
    time.sleep(0.3)
    
    # Limpar via JS (evita problemas com masks)
    driver.execute_script("arguments[0].value = '';", el)
    
    # Click via JS para garantir foco (ignora qualquer overlay)
    driver.execute_script("arguments[0].click();", el)
    time.sleep(0.3)
    
    el.send_keys(valor)
    time.sleep(0.5)


def filtro_data(data1, data2, driver):
    """Preenche os campos de data de início e fim com tratamento robusto de overlays."""
    _preencher_data(driver, "form-filtroAcss-dataId-dataTipo-beginDate", data1)
    _preencher_data(driver, "form-filtroAcss-dataId-dataTipo-endDate", data2)


def trocar_localidade(localidade, driver):
    time.sleep(1)
    esperar_sumir(driver)
    driver.find_element(by=By.ID, value="form-filtroAcss-solicitacaoLocalidadeId-j_idt198-cb-input").clear()
    time.sleep(1)
    esperar_sumir(driver)
    driver.find_element(by=By.ID, value="form-filtroAcss-solicitacaoLocalidadeId-j_idt198-cb-input").click()
    time.sleep(1)
    esperar_sumir(driver)
    driver.find_element(by=By.ID, value="form-filtroAcss-solicitacaoLocalidadeId-j_idt198-cb-input").send_keys(localidade)
    time.sleep(1)
    esperar_sumir(driver)


def pesq_exp(driver, temp_download_dir, target_dir):
    global num_downloads
    esperar_sumir(driver)
    
    # Clicar no botão de busca de forma segura (sem duplo clique problemático)
    _clicar_seguro(driver, "form-filtroAcss-toolbox-btn-search")
    
    # IMPORTANTE: Esperar a tabela carregar completamente antes de exportar
    print("[PESQUISA] Aguardando tabela carregar...")
    time.sleep(3)  # Delay inicial para começar o carregamento
    
    # Esperar até que a tabela tenha linhas de dados ou timeout
    try:
        WebDriverWait(driver, 35).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table tbody tr"))
        )
        print("[PESQUISA] Tabela carregada com dados!")
        time.sleep(3)  # Delay adicional para garantir que todos os dados foram renderizados
    except TimeoutException:
        print("[PESQUISA] AVISO: Timeout ao aguardar dados na tabela (carregamento longo ou sem registros).")
    
    try:
        # Verificar se o botão de exportação existe (aguarda até 10s para carregamentos lentos como Carro Pipa)
        try:
            botao_export = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, "form-grid-grid-exportCSVBtn-exportarcsv"))
            )
        except (NoSuchElementException, ElementNotInteractableException, TimeoutException):
            print("AVISO: Sem dados para exportar ou busca sem resultados. Pulo para a próxima.")
            return

        # === EXPORTAR COM RETRY: se CSV vier vazio, tenta de novo ===
        max_tentativas = 3
        delays_retry = [3, 5, 8]  # Segundos de espera antes de cada retry

        for tentativa in range(1, max_tentativas + 1):
            # Limpar pasta temporária antes de baixar
            for f in glob.glob(os.path.join(temp_download_dir, "*")):
                try:
                    os.remove(f)
                except:
                    pass

            # Clicar no botão de exportação com segurança
            try:
                botao_export = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.ID, "form-grid-grid-exportCSVBtn-exportarcsv"))
                )
                driver.execute_script("arguments[0].scrollIntoView(true);", botao_export)
                time.sleep(0.5)
                try:
                    botao_export.click()
                except Exception:
                    driver.execute_script("arguments[0].click();", botao_export)
                print(f"[EXPORT] Botão de exportação clicado! (tentativa {tentativa}/{max_tentativas})")
            except (NoSuchElementException, ElementNotInteractableException, TimeoutException):
                print("AVISO: Botão de exportação desapareceu. Abortando.")
                return
            
            # Esperar o download concluir
            timeout = 60
            start_time = time.time()
            file_path = None
            
            while time.time() - start_time < timeout:
                files = glob.glob(os.path.join(temp_download_dir, "*.csv")) 
                valid_files = [f for f in files if not f.endswith('.part')]
                
                if valid_files:
                    file_path = max(valid_files, key=os.path.getctime)
                    break
                time.sleep(1)
            
            if not file_path:
                print("Erro: Download não concluído no tempo limite.")
                return

            # === VALIDAÇÃO: Verificar se o CSV contém dados reais ===
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                data_lines = [l.strip() for l in lines if l.strip()]
            except Exception as e_read:
                print(f"⚠ AVISO: Não foi possível ler o CSV: {e_read}")
                data_lines = []

            if len(data_lines) >= 2:
                # CSV válido com dados! Mover para destino.
                filename = os.path.basename(file_path)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                new_filename = f"{timestamp}_{filename}"
                dest_path = os.path.join(target_dir, new_filename)
                
                os.makedirs(target_dir, exist_ok=True)
                shutil.move(file_path, dest_path)
                
                with lock:
                    num_downloads += 1
                    dedos_extraidos.append(num_downloads)
                    current_download_num = num_downloads
                print(f"Planilha nº {current_download_num} extraida e movida para: {dest_path}")
                return  # Sucesso!
            else:
                # CSV veio vazio — tabela ainda não renderizou
                os.remove(file_path)
                if tentativa < max_tentativas:
                    wait_time = delays_retry[tentativa - 1]
                    print(f"⚠ CSV veio vazio (tentativa {tentativa}/{max_tentativas}). Aguardando {wait_time}s e tentando novamente...")
                    time.sleep(wait_time)
                else:
                    print(f"⚠ ERRO: CSV veio vazio após {max_tentativas} tentativas. Exportação falhou para este filtro.")

    except Exception as e:
        print(f"Erro Unidade de medição ou manipulação de arquivo: {e}")


def trocar_tipo_data(driver):
    wait = WebDriverWait(driver, 10)
    esperar_sumir(driver)
    try:
        # Espera o elemento estar presente no DOM
        wait.until(EC.presence_of_element_located((By.ID, "form-filtroAcss-dataId-dataTipo-item")))
        # Seleciona o valor via JavaScript para evitar problemas de sobreposição
        driver.execute_script(
            "document.getElementById('form-filtroAcss-dataId-dataTipo-item').value = 'ABERTURA_OS';"
        )
        # Dispara o evento change para garantir atualização
        driver.execute_script(
            "document.getElementById('form-filtroAcss-dataId-dataTipo-item').dispatchEvent(new Event('change'));"
        )
        print("Tipo de data alterado para 'Abertura da OS' (valor: ABERTURA_OS) via JavaScript")
        time.sleep(1)
    except Exception as e:
        print(f"Erro ao trocar tipo de data via JS: {e}")
        raise

def selecionar_situacao_os(driver):
    wait = WebDriverWait(driver, 20)

    # 1️⃣ Achar o container do campo Situação da OS pelo input real (mais restrito)
    container = wait.until(EC.presence_of_element_located((
        By.XPATH, "//input[contains(@id,'form-filtroAcss-ordemServicoSituacao')]/ancestor::div[contains(@class,'cc-item-container')]"
    )))

    # 2️⃣ Dentro desse container, pegar APENAS o chosen desse campo
    chosen = container.find_element(By.CSS_SELECTOR, "div.chosen-container")
    wait.until(EC.element_to_be_clickable(chosen)).click()
    time.sleep(0.5)

    # 3️⃣ Input do chosen
    input_chosen = chosen.find_element(By.CSS_SELECTOR, "li.search-field input")

    # 4️⃣ Limpar seleções já existentes (clicando nos X)
    while True:
        try:
            remover = chosen.find_element(By.CSS_SELECTOR, "a.search-choice-close")
            remover.click()
            time.sleep(0.2)
        except:
            break

    # 5️⃣ Selecionar "Aberta"
    input_chosen.send_keys("Aberta")
    time.sleep(0.5)
    input_chosen.send_keys(Keys.ENTER)
    time.sleep(0.5)

    # 6️⃣ Selecionar "Programada"
    input_chosen.send_keys("Programada")
    time.sleep(0.5)
    input_chosen.send_keys(Keys.ENTER)
    time.sleep(0.5)




# --- FUNÇÃO PRINCIPAL CORRIGIDA ---
def definitiva(filtro, data_inicio, data_fim, callback=None, driver_path=None, target_dir=None, headless=True):
    """
    Função principal de extração.
    Agora aceita data_inicio e data_fim como strings no formato 'DD/MM/YYYY'.
    Exemplo: definitiva(filtro, '01/02/2026', '07/02/2026')
    Salva os downloads diretamente no target_dir informado ou mapeado pelo filtro.
    """
    global num_downloads
    # NOTA: NÃO resetar num_downloads aqui!
    # O reset é feito pelo client_local_mestre.py antes de iniciar os threads.
    # Resetar aqui causa race condition com múltiplos threads.
    
    # Mapeamento Automático de Filtros -> Pastas (Dinâmico para VPS)
    base_path = os.path.join(os.path.dirname(__file__), "dados")
    pastas_mapeadas = {
        "form-filtroAcss-dlgFilterPrefs-tableUser-4-j_idt341": os.path.join(base_path, "Falta_dagua"),        
        "form-filtroAcss-dlgFilterPrefs-tableUser-5-j_idt341": os.path.join(base_path, "Pavimento"),
        "form-filtroAcss-dlgFilterPrefs-tableUser-6-j_idt341": os.path.join(base_path, "Vazamento"),
        "form-filtroAcss-dlgFilterPrefs-tableUser-3-j_idt341": os.path.join(base_path, "Carro_pipa"),
    }
    
    # Se não foi passado um diretório via argumento, tenta o mapeamento pelo filtro
    if not target_dir:
        target_dir = pastas_mapeadas.get(filtro, os.path.join(base_path, "Extrações_Pendencias"))
    
    # Declaração de Variaveis
    user = SCI_USER
    passw = SCI_PASSWORD
    url = 'http://sciweb.embasanet.ba.gov.br/sci-web/'

    if callback: callback(f"Iniciando Extração em: {target_dir}")

    # Criar diretório temporário para esta execução
    temp_dir_obj = tempfile.TemporaryDirectory()
    temp_download_dir = temp_dir_obj.name

    if callback: callback(f"Dir Temp: {temp_download_dir}")

    options = Options()
    if headless:
        options.add_argument("--headless")
    options.set_preference("browser.download.panel.shown", False)
    options.set_preference("browser.download.animateNotifications", False)
    options.set_preference("browser.download.manager.showWhenStarting", False)
    options.set_preference("browser.download.manager.showAlertOnComplete", False)
    options.set_preference("browser.download.manager.closeWhenDone", True)
    options.set_preference("browser.download.manager.focusWhenStarting", False)
    options.set_preference("browser.download.manager.useWindow", False)
    options.set_preference("browser.download.alwaysOpenPanel", False)
    options.set_preference("browser.download.autohideButton", True)
    options.set_preference("browser.download.folderList", 2) # 2: Custom folder
    options.set_preference("browser.download.dir", temp_download_dir) # Set custom temp dir
    options.set_preference("browser.download.useDownloadDir", True)
    options.set_preference("pdfjs.disabled", True) # Disable built-in PDF viewer

    driver = None
    try:
        if driver_path:
            service = Service(executable_path=driver_path, log_output=DEVNULL)
        else:
            service = Service(GeckoDriverManager().install(), log_output=DEVNULL)

        driver = webdriver.Firefox(service=service, options=options)
        driver.get(url)

        if callback: callback("Realizando login no sistema...")
        
        time.sleep(1)
        # Login
        randomtag = driver.find_element(by=By.ID, value="random-tag").get_attribute('value')
        driver.find_element(by=By.ID, value=f"loginForm-usuario-{randomtag}").send_keys(user)
        driver.find_element(by=By.ID, value=f"loginForm-senha-{randomtag}").send_keys(passw)
        driver.find_element(by=By.ID, value="loginForm-submit").click()

        if callback: callback("Acessando área de Consulta Geral...")
        
        esperar_sumir(driver)
        driver.find_element(by=By.ID, value="arvoreSearch").send_keys("pend")  
        esperar_sumir(driver)

        wait = WebDriverWait(driver, 10)
        wait.until(EC.element_to_be_clickable((By.ID, 'ACSS_anchor')))

        driver.find_element(by=By.ID, value="ACSS_anchor").click()
        driver.switch_to.frame("frame-content")

        if callback: callback("Aplicando filtro inicial...")
        abrir_filtro(filtro, driver)
        esperar_sumir(driver)
        time.sleep(1)

        # Validar que as datas foram fornecidas
        if not data_inicio or not data_fim:
            if callback: callback("ERRO: Data de início e fim são obrigatórias!")
            return

        # Extração com período completo (sem reparticionamento)
        msg = f"Extraindo período completo: {data_inicio} até {data_fim}"
        print(msg)
        if callback: callback(msg)

        # Aplicar o filtro de data uma única vez com o período completo
        filtro_data(data_inicio, data_fim, driver)
        esperar_sumir(driver)
        
        # Executar extração
        pesq_exp(driver, temp_download_dir, target_dir)
        esperar_sumir(driver)
        
        time.sleep(1)

        # Verificar se houve alerta inesperado (comum no final)
        try:
            alert = driver.switch_to.alert
            print(f"Alerta detectado e ignorado: {alert.text}")
            alert.accept()
        except:
            pass

        if callback: callback("Finalizando processo...")
        time.sleep(5) # Pequeno delay antes de fechar

    except Exception as e:
        erro = f"Erro fatal na automação: {str(e)}"
        print(erro)
        if callback: callback(erro)
        raise e # Relança erro para o client_local tratar
    finally:
        if driver:
            driver.quit()
        # Limpar diretório temporário
        if 'temp_dir_obj' in locals():
            temp_dir_obj.cleanup()





