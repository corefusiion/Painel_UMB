# -*- coding: utf-8 -*-
"""
Agendador Automatico - Extracao de Pendencias + Upload ao Supabase.

Executa o ciclo completo automaticamente a cada X minutos:
  1. Extrai CSVs do SCI Web (Vazamento, Pavimento, Falta Dagua)
  2. Envia para o Supabase via Edge Function
  3. Limpa CSVs apos envio bem-sucedido

Uso:
  python agendador.py                                -> Executa a cada 60 min (ultimos 5 dias)
  python agendador.py --intervalo 5                  -> Executa a cada 5 minutos
  python agendador.py --inicio 01/02/2026 --fim 20/02/2026  -> Periodo especifico
  python agendador.py --uma-vez                      -> Executa apenas uma vez e sai
  python agendador.py --headless                     -> Roda Firefox sem janela visivel

Padrao do periodo: ultimos 10 dias ate hoje (se nao informar --inicio/--fim).
"""

import sys
import os
import time
import threading
import argparse
import json
from datetime import datetime, timedelta

# Adicionar pasta do projeto ao path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import funcoes
import upload_supabase

# bridge_notify.py is at the project root (2 levels up from this script)
_PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

try:
    from bridge_notify import notify_caio
except ImportError:
    def notify_caio(*args, **kwargs):
        print("[bridge_notify] Not available - skipping Telegram notification")

# Filtros das 3 categorias (mesmos IDs do main.py)
FILTROS = [
    "form-filtroAcss-dlgFilterPrefs-tableUser-4-j_idt341",  # Vazamento
    "form-filtroAcss-dlgFilterPrefs-tableUser-5-j_idt341",  # Pavimento
    "form-filtroAcss-dlgFilterPrefs-tableUser-6-j_idt341",  # Falta_dagua
    "form-filtroAcss-dlgFilterPrefs-tableUser-3-j_idt341",  # Carro_pipa
]

def save_status(status_dict):
    """Salva o status atual em status.json para o Dashboard."""
    try:
        status_path = os.path.join(SCRIPT_DIR, 'status.json')
        with open(status_path, 'w', encoding='utf-8') as f:
            json.dump(status_dict, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Erro ao salvar status.json: {e}")



def executar_extracao(headless=False, data_inicio_str=None, data_fim_str=None):
    """
    Executa o ciclo completo: extração SCI + upload Supabase + limpeza.
    Retorna True se completou sem erros críticos.
    """
    inicio = datetime.now()
    total_filtros = len(FILTROS)
    nomes_filtros = ["Vazamento", "Pavimento", "Falta d'Água", "Carro Pipa"]

    print(f"\n{'='*60}")
    print(f"--- CICLO AUTOMATICO INICIADO ---")
    print(f"   {inicio.strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"{'='*60}")
    
    if not data_fim_str:
        data_fim_str = datetime.now().strftime('%d/%m/%Y')
    if not data_inicio_str:
        data_inicio_str = (datetime.now() - timedelta(days=1)).strftime('%d/%m/%Y')
    
    print(f"\nPeriodo: {data_inicio_str} ate {data_fim_str}")

    # Load existing status to carry over today_extractions counter
    _existing_status = {}
    _status_path = os.path.join(SCRIPT_DIR, 'status.json')
    if os.path.exists(_status_path):
        try:
            with open(_status_path, 'r', encoding='utf-8') as _f:
                _existing_status = json.load(_f)
        except Exception:
            pass
    _today_str = datetime.now().strftime('%Y-%m-%d')
    if _existing_status.get('today_date') == _today_str:
        _today_count = _existing_status.get('today_extractions', 0)
    else:
        _today_count = 0  # New day — reset

    # Status inicial
    thread_status = {nome: "⏳ Aguardando" for nome in nomes_filtros}
    status_data = {
        "status": "executando",
        "status_detail": "Etapa 1/4: Iniciando extração no SCI Web...",
        "progress_pct": 5,
        "last_run": inicio.isoformat(),
        "next_run": None,
        "thread_status": thread_status,
        "db_confirmed": False,
        "success_summary": None,
        "today_extractions": _today_count,
        "today_date": _today_str,
        "metrics": {
            "total_downloads": 0,
            "uploads_ok": 0,
            "uploads_error": 0,
            "last_duration": None
        }
    }
    save_status(status_data)
    
    # === ETAPA 1: INSTALAR DRIVER ===
    print(f"[ETAPA 1/4] Preparando Selenium Driver...")
    try:
        driver_path = funcoes.install_driver()
        print(f"OK - GeckoDriver pronto: {driver_path}")
    except Exception as e:
        print(f"FAIL - ERRO ao instalar driver: {e}")
        status_data["status"] = "erro"
        status_data["status_detail"] = f"Erro: Falha ao carregar driver Selenium"
        status_data["progress_pct"] = 0
        save_status(status_data)
        return False
    
    # === ETAPA 2: EXTRAÇÃO MULTI-THREAD ===
    print(f"[ETAPA 2/4] Extraindo dados do SCI Web com {total_filtros} threads...")
    status_data["status_detail"] = f"Etapa 2/4: Extraindo {total_filtros} categorias em paralelo..."
    status_data["progress_pct"] = 10
    save_status(status_data)

    funcoes.num_downloads = 0
    funcoes.dedos_extraidos = []

    threads_concluidas = [False] * total_filtros

    def executar_filtro(idx, filtro):
        """Wrapper que executa um filtro com retry automático para crashes de memória."""
        nome = nomes_filtros[idx]
        MAX_RETRIES = 2
        RETRY_DELAY = 12  # segundos — dá tempo ao SO liberar memória do Firefox morto

        for tentativa in range(1, MAX_RETRIES + 2):  # até MAX_RETRIES+1 tentativas no total
            if tentativa > 1:
                thread_status[nome] = f"🔁 Retry {tentativa-1}/{MAX_RETRIES}..."
                status_data["thread_status"] = thread_status
                save_status(status_data)
                print(f"  [RETRY] {nome}: aguardando {RETRY_DELAY}s antes de nova tentativa...")
                time.sleep(RETRY_DELAY)
            else:
                thread_status[nome] = "🔄 Extraindo..."
                save_status(status_data)

            try:
                funcoes.definitiva(filtro, data_inicio_str, data_fim_str,
                                   driver_path=driver_path, headless=headless)
                thread_status[nome] = "✅ Concluído"
                break  # Sucesso — sair do loop de retry
            except Exception as e:
                err_str = str(e).lower()
                is_memory_crash = "marionette" in err_str or "decode" in err_str or "session" in err_str
                if is_memory_crash and tentativa <= MAX_RETRIES:
                    print(f"  [RETRY] {nome}: crash de memória detectado ({type(e).__name__}). Tentando novamente...")
                    continue
                # Erro não recuperável ou sem mais tentativas
                thread_status[nome] = f"❌ Erro: {str(e)[:35]}"
                break
            finally:
                threads_concluidas[idx] = True
                concluidas = sum(threads_concluidas)
                pct = 10 + int((concluidas / total_filtros) * 50)
                status_data["progress_pct"] = pct
                status_data["thread_status"] = thread_status
                status_data["status_detail"] = f"Etapa 2/4: ({concluidas}/{total_filtros} threads concluídas)"
                save_status(status_data)

    # Escalonar o início das threads (5s entre cada Firefox) para evitar pico de RAM
    STAGGER_DELAY = 5  # segundos entre cada Firefox abrindo
    try:
        threads = []
        for i, filtro in enumerate(FILTROS):
            if i > 0:
                print(f"  ⏳ Aguardando {STAGGER_DELAY}s para iniciar próxima thread (proteção de memória)...")
                time.sleep(STAGGER_DELAY)
            t = threading.Thread(target=executar_filtro, args=[i, filtro])
            t.daemon = True
            t.start()
            threads.append(t)
            thread_status[nomes_filtros[i]] = "🔄 Iniciando..."
            print(f"  --> Thread {i+1}/{total_filtros}: {nomes_filtros[i]}")
        
        for t in threads:
            t.join()

        
        total_downloads = funcoes.num_downloads
        print(f"\n✓ Extração finalizada. Downloads: {total_downloads}")
        
        if total_downloads == 0:
            status_data["status"] = "online"
            status_data["status_detail"] = "Concluído: Nenhuma pendência nova encontrada."
            status_data["progress_pct"] = 100
            status_data["success_summary"] = "✅ Extração concluída. Nenhum registro novo encontrado no período informado."
            save_status(status_data)
            return True
            
    except Exception as e:
        print(f"✗ ERRO na extração: {e}")
        status_data["status"] = "erro"
        status_data["status_detail"] = f"Erro na Extração: {str(e)[:60]}"
        status_data["progress_pct"] = 0
        save_status(status_data)
        return False
    
    # === ETAPA 3: UPLOAD AO SUPABASE ===
    print(f"[ETAPA 3/4] Upload de {total_downloads} arquivos ao Supabase...")
    status_data["status_detail"] = f"Etapa 3/4: Enviando {total_downloads} registro(s) ao Supabase..."
    status_data["progress_pct"] = 65
    status_data["metrics"]["total_downloads"] = total_downloads
    status_data["db_confirmed"] = False
    save_status(status_data)
    
    try:
        ok, erros = upload_supabase.upload_all()
    except Exception as e:
        print(f"✗ ERRO no upload: {e}")
        ok, erros = 0, total_downloads

    # === ETAPA 4: FINALIZAÇÃO ===
    fim = datetime.now()
    duracao = fim - inicio

    print(f"\n{'='*60}")
    print(f"[ETAPA 4/4] DONE - CICLO COMPLETO")
    print(f"   Downloads: {total_downloads}")
    print(f"   Uploads: {ok} arquivo(s), {erros} erro(s)")
    print(f"   Duracao: {str(duracao).split('.')[0]}")
    print(f"{'='*60}")
    
    db_confirmed = ok > 0 and erros == 0
    success = erros == 0

    # Montar resumo de sucesso legível
    threads_resumo = " | ".join([f"{nome}: {st}" for nome, st in thread_status.items()])
    if success:
        success_summary = (
            f"✅ Extração concluída com sucesso!\n"
            f"📦 {ok} registro(s) enviados ao Supabase\n"
            f"⏱️ Duração: {str(duracao).split('.')[0]}\n"
            f"📅 {inicio.strftime('%d/%m/%Y %H:%M')}"
        )
    else:
        success_summary = (
            f"⚠️ Extração concluída com {erros} erro(s).\n"
            f"📦 {ok} enviado(s), {erros} falhou(aram)\n"
            f"⏱️ Duração: {str(duracao).split('.')[0]}"
        )

    # Notificar via Telegram (bridge_notify → API Gateway → Bot)
    status_emoji = "✅" if success else "⚠️"
    notify_caio(
        title=f"Extração de Pendências {status_emoji}",
        message=(
            f"*Ciclo finalizado!*\n\n"
            f"📥 Downloads: {total_downloads}\n"
            f"✅ Enviados ao Supabase: {ok}\n"
            f"❌ Falhas: {erros}\n"
            f"⏱ Duração: {str(duracao).split('.')[0]}\n\n"
            f"🧵 Threads:\n{threads_resumo}"
        ),
        msg_type="success" if success else "warning"
    )

    save_status({
        "status": "online",
        "status_detail": "Aguardando próximo ciclo",
        "progress_pct": 100,
        "last_run": inicio.isoformat(),
        "next_run": None,
        "thread_status": thread_status,
        "db_confirmed": db_confirmed,
        "success_summary": success_summary,
        "today_extractions": _today_count + 1,  # Increment daily counter
        "today_date": _today_str,
        "metrics": {
            "total_downloads": total_downloads,
            "uploads_ok": ok,
            "uploads_error": erros,
            "last_duration": str(duracao).split('.')[0]
        }
    })

    return success



def main():
    parser = argparse.ArgumentParser(
        description="Agendador automatico de extracao de Pendencias + Upload ao Supabase"
    )
    parser.add_argument(
        '--intervalo', type=int, default=60,
        help='Intervalo entre execuções em minutos (padrão: 60)'
    )
    parser.add_argument(
        '--inicio', type=str, default=None,
        help='Data início no formato DD/MM/YYYY (padrão: hoje - 10 dias)'
    )
    parser.add_argument(
        '--fim', type=str, default=None,
        help='Data fim no formato DD/MM/YYYY (padrão: hoje)'
    )
    parser.add_argument(
        '--uma-vez', action='store_true',
        help='Executa apenas uma vez e sai'
    )
    parser.add_argument(
        '--headless', action='store_true',
        help='Roda Firefox sem janela visível'
    )
    args = parser.parse_args()
    
    # Resolver período
    periodo_inicio = args.inicio or (datetime.now() - timedelta(days=10)).strftime('%d/%m/%Y')
    periodo_fim = args.fim or datetime.now().strftime('%d/%m/%Y')
    
    print("=" * 60)
    print("ROBOT AGENDADOR AUTOMATICO - Pendencias + Supabase")
    print(f"   Periodo: {periodo_inicio} ate {periodo_fim}")
    print(f"   Intervalo: {'Uma vez' if args.uma_vez else f'A cada {args.intervalo} minutos'}")
    print(f"   Headless: {'Sim' if args.headless else 'Nao'}")
    print(f"   Iniciado: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 60)
    
    # Execução única
    if args.uma_vez:
        executar_extracao(headless=args.headless, data_inicio_str=periodo_inicio, data_fim_str=periodo_fim)
        return
    
    # Loop contínuo
    ciclo = 0
    while True:
        ciclo += 1
        print(f"\n{'#'*60}")
        print(f"# CICLO {ciclo} - {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
        print(f"{'#'*60}")
        
        try:
            executar_extracao(headless=args.headless, data_inicio_str=periodo_inicio, data_fim_str=periodo_fim)
        except Exception as e:
            print(f"\n✗ ERRO INESPERADO no ciclo {ciclo}: {e}")
        
        proxima = datetime.now() + timedelta(minutes=args.intervalo)
        print(f"\nPROXIMA execucao: {proxima.strftime('%d/%m/%Y %H:%M:%S')}")
        print(f"   Aguardando {args.intervalo} minutos...")
        
        # Atualizar next_run no status.json
        try:
            status_path = os.path.join(SCRIPT_DIR, 'status.json')
            if os.path.exists(status_path):
                with open(status_path, 'r', encoding='utf-8') as f:
                    curr = json.load(f)
                curr["next_run"] = proxima.isoformat()
                save_status(curr)
        except: pass

        
        try:
            time.sleep(args.intervalo * 60)
        except KeyboardInterrupt:
            print("\n\n🛑 Agendador interrompido pelo usuário (Ctrl+C)")
            break
    
    print("\n👋 Agendador finalizado.")


if __name__ == "__main__":
    main()
