# -*- coding: utf-8 -*-
"""
UMBMAS - SISTEMA MESTRE DE EXTRAÇÃO E INTELIGÊNCIA INTEGRADA
============================================================
Unifica a automação em um pipeline sequencial, seguro e organizado:

  [FASE 1] Extração de Pendências (Vazamento, Pavimento, Falta d'Água Pendente, Carro Pipa) -> Projeto 1
  [PAUSA] 3 segundos de descanso de drivers/memória
  [FASE 2] Extração de Falta d'Água Executadas (Ontem e Hoje) -> Projeto 3 (Saneaia ML) + Projeto 1 (Aba 2)
  [FASE 3] Re-processamento Automático da Análise Preditiva (IA Saneaia) -> Projeto 1 (Painel UMB)

Modos:
  1. Extração Única Completa
  2. Agendador Automático (Recorrente a cada 60 minutos)
"""

import sys
import os
import time
import json
from datetime import datetime, timedelta
import urllib.request
import urllib.parse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import funcoes
import upload_supabase
import falta_dagua_ex
import detalhar_ss_os
import extracao_de_detalhes

FILTROS_PENDENCIAS = [
    "form-filtroAcss-dlgFilterPrefs-tableUser-4-j_idt341",  # Falta_dagua Pendente
    "form-filtroAcss-dlgFilterPrefs-tableUser-5-j_idt341",  # Pavimento
    "form-filtroAcss-dlgFilterPrefs-tableUser-6-j_idt341",  # Vazamento
    "form-filtroAcss-dlgFilterPrefs-tableUser-3-j_idt341",  # Carro_pipa
]

NOMES_FILTROS = ["Falta d'Água Pendente", "Pavimento", "Vazamento", "Carro Pipa"]

def print_banner():
    print("\n" + "=" * 70)
    print("      UMBMAS - SISTEMA MESTRE DE EXTRAÇÃO E INTELIGÊNCIA INTEGRADA")
    print("=" * 70)

def reprocessar_analise_preditiva():
    """Dispara a Análise Preditiva no Saneaia FastAPI e atualiza o Painel UMB."""
    print("\n[FASE 3/3] 🧠 Disparando recálculo da Análise Preditiva (IA Saneaia)...")
    try:
        # 1. Buscar demandas em aberto do Projeto 1
        req = urllib.request.urlopen("http://localhost:3001/api/faltadagua")
        res = json.loads(req.read().decode('utf-8'))
        demandas = res.get("data", [])
        
        if not demandas:
            print("  ℹ Nenhuma demanda pendente encontrada para análise preditiva.")
            return

        payload = {
            "demandas": [
                {
                    "id": str(d.get("id")),
                    "numero_os": str(d.get("numero_os")),
                    "matricula": str(d.get("matricula") or d.get("numero_os")),
                    "logradouro": str(d.get("logradouro") or ""),
                    "bairro_nome": str(d.get("bairro_nome") or ""),
                    "observacao": str(d.get("observacao") or "")
                }
                for d in demandas if not str(d.get("servico", "")).startswith("37")
            ]
        }

        # 2. Limpar insights antigos para forçar cálculo limpo
        try:
            req_del = urllib.request.Request("http://localhost:3001/api/ai_insights_faltadagua", method="DELETE")
            urllib.request.urlopen(req_del)
        except Exception:
            pass

        # 3. Enviar ao Saneaia FastAPI (porta 8000)
        data_bytes = json.dumps(payload).encode('utf-8')
        req_ai = urllib.request.Request(
            "http://localhost:8000/api/integrations/analyze-external-demands",
            data=data_bytes,
            headers={"Content-Type": "application/json"}
        )
        resp_ai = urllib.request.urlopen(req_ai)
        result_ai = json.loads(resp_ai.read().decode('utf-8'))
        
        analises = result_ai.get("analises", [])
        print(f"  ✓ IA Saneaia processou {len(analises)} insights preditivos.")

        # 4. Salvar insights gerados no SQLite Local do Projeto 1
        for insight in analises:
            ins_bytes = json.dumps(insight).encode('utf-8')
            req_ins = urllib.request.Request(
                "http://localhost:3001/api/ai_insights_faltadagua",
                data=ins_bytes,
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(req_ins)
        
        print("  ✓ Análise Preditiva sincronizada com sucesso no Dashboard do Projeto 1!")
    except Exception as e:
        print(f"  ⚠ Aviso durante sincronização da Análise Preditiva: {e}")

def executar_ciclo_completo(dt_inicio=None, dt_fim=None, headless=True, cancel_event=None, progress_callback=None):
    """Executa o pipeline completo de extração sequencial e inteligência."""
    if not dt_inicio or not dt_fim:
        dt_inicio = (datetime.now() - timedelta(days=1)).strftime("%d/%m/%Y")
        dt_fim = datetime.now().strftime("%d/%m/%Y")

    print("\n" + "=" * 70)
    print(f"🚀 CICLO COMPLETO INICIADO — {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"   Período de Extração: {dt_inicio} até {dt_fim} | Modo Headless: {headless}")
    print("=" * 70)

    if progress_callback:
        progress_callback({"etapa": "Iniciando Ciclo Completo", "progresso_pct": 5})

    # -------------------------------------------------------------
    # FASE 1: Extração de Executadas (Projeto 3 e Aba 2 Projeto 1)
    # -------------------------------------------------------------
    if cancel_event and cancel_event.is_set():
        print("[CANCELADO] Execução interrompida antes da Fase 1.")
        return

    print(f"\n[FASE 1/3] 💧 Extraindo Falta d'Água Executadas ({dt_inicio} a {dt_fim} -> Projeto 3 Saneaia)...")
    if progress_callback:
        progress_callback({"etapa": "Extraindo Falta d'Água Executadas", "progresso_pct": 15})

    try:
        falta_dagua_ex.main(dt_inicio, dt_fim, headless=headless)
        print("  ✓ FASE 1 (Executadas / Saneaia) concluída com sucesso!")
    except Exception as e:
        print(f"  ✗ Erro na FASE 1 (Executadas): {e}")

    # -------------------------------------------------------------
    # PAUSA TÉCNICA
    # -------------------------------------------------------------
    time.sleep(2)

    # -------------------------------------------------------------
    # FASE 1.5: Extração Profunda de Detalhes (Raspagem de HTML)
    # -------------------------------------------------------------
    if cancel_event and cancel_event.is_set():
        print("[CANCELADO] Execução interrompida antes dos Detalhes.")
        return

    print(f"\n[FASE 1.5/3] 🔍 Buscando e detalhando novas OSs executadas...")
    if progress_callback:
        progress_callback({"etapa": "Buscando Detalhes das OSs", "progresso_pct": 40})

    try:
        # Baixa os HTMLs apenas do que não está detalhado
        detalhar_ss_os.processar_lote_banco(dt_inicio, dt_fim, headless=headless, cancel_event=cancel_event, progress_callback=progress_callback)
        
        # Faz o parse e injeta no banco
        extracao_de_detalhes.processar_htmls()
        print("  ✓ FASE 1.5 (Extração de Detalhes) concluída com sucesso!")
    except Exception as e:
        print(f"  ✗ Erro na FASE 1.5 (Detalhamento): {e}")

    # -------------------------------------------------------------
    # PAUSA TÉCNICA
    # -------------------------------------------------------------
    time.sleep(2)

    # -------------------------------------------------------------
    # FASE 2: Extração de Pendências (Projeto 1)
    # -------------------------------------------------------------
    if cancel_event and cancel_event.is_set():
        print("[CANCELADO] Execução interrompida antes das Pendências.")
        return

    print("\n[FASE 2/3] 📂 Extraindo Solicitações Pendentes (4 Categorias -> Projeto 1)...")
    if progress_callback:
        progress_callback({"etapa": "Extraindo Solicitações Pendentes", "progresso_pct": 65})

    try:
        driver_path = funcoes.install_driver()
        funcoes.num_downloads = 0
        funcoes.dedos_extraidos = []

        for idx, f_id in enumerate(FILTROS_PENDENCIAS):
            if cancel_event and cancel_event.is_set():
                print("[CANCELADO] Extração de pendências cancelada pelo usuário.")
                break

            nome = NOMES_FILTROS[idx]
            if progress_callback:
                progress_callback({"etapa": f"Extraindo Pendências: {nome} ({idx+1}/4)", "progresso_pct": 65 + (idx * 5)})

            sucesso = False
            for tentativa in range(1, 3): # Tenta até 2 vezes
                print(f"  -> Extraindo {nome} ({idx+1}/4) - Tentativa {tentativa}...")
                try:
                    funcoes.definitiva(f_id, dt_inicio, dt_fim, driver_path=driver_path, headless=headless)
                    print(f"     ✓ {nome} extraído com sucesso na tentativa {tentativa}!")
                    sucesso = True
                    break # Sai do loop de tentativas se deu certo
                except Exception as err:
                    print(f"     ⚠ Erro ao extrair {nome} na tentativa {tentativa}: {err}")
                    time.sleep(3) # Pausa antes de tentar de novo
            
            if not sucesso:
                print(f"     ❌ Falha definitiva ao extrair {nome} após 2 tentativas.")
        
        print("\n  Enviando solicitações pendentes ao Backend Express (Painel UMB)...")
        upload_supabase.upload_all()
        print("  ✓ FASE 2 (Pendências) concluída com sucesso!")

    except Exception as e:
        print(f"  ✗ Erro na FASE 2 (Pendências): {e}")

    # -------------------------------------------------------------
    # FASE 3: Análise Preditiva (Saneaia IA)
    # -------------------------------------------------------------
    if cancel_event and cancel_event.is_set():
        print("[CANCELADO] Execução interrompida antes da Análise Preditiva.")
        return

    if progress_callback:
        progress_callback({"etapa": "Calculando Análise Preditiva IA", "progresso_pct": 90})

    reprocessar_analise_preditiva()

    if progress_callback:
        progress_callback({"etapa": "Extração Concluída", "progresso_pct": 100})

    print("\n" + "=" * 70)
    print(f"✨ CICLO COMPLETO DE EXTRAÇÃO E INTELIGÊNCIA CONCLUÍDO! — {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 70 + "\n")

def executar_ciclo_executadas(dt_inicio, dt_fim, headless=True, cancel_event=None, progress_callback=None):
    """Executa apenas a FASE 1 (Falta d'Agua Ex) e FASE 1.5 (Detalhes)."""
    print("\n" + "=" * 70)
    print(f"🚀 CICLO ISOLADO: EXECUTADAS E DETALHES INICIADO — {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"   Período de Extração: {dt_inicio} até {dt_fim} | Modo Headless: {headless}")
    print("=" * 70)

    if progress_callback:
        progress_callback({"etapa": "Extraindo Falta d'Água Executadas", "progresso_pct": 20})

    print(f"\n[FASE 1/2] 💧 Extraindo Falta d'Água Executadas ({dt_inicio} a {dt_fim} -> Projeto 3 Saneaia)...")
    try:
        falta_dagua_ex.main(dt_inicio, dt_fim, headless=headless)
        print("  ✓ FASE 1 (Executadas / Saneaia) concluída com sucesso!")
    except Exception as e:
        print(f"  ✗ Erro na FASE 1 (Executadas): {e}")

    time.sleep(2)

    if cancel_event and cancel_event.is_set():
        print("[CANCELADO] Execução interrompida antes dos Detalhes.")
        return

    print(f"\n[FASE 2/2] 🔍 Buscando e detalhando novas OSs executadas...")
    if progress_callback:
        progress_callback({"etapa": "Buscando Detalhes das OSs", "progresso_pct": 60})

    try:
        detalhar_ss_os.processar_lote_banco(dt_inicio, dt_fim, headless=headless, cancel_event=cancel_event, progress_callback=progress_callback)
        extracao_de_detalhes.processar_htmls()
        print("  ✓ FASE 2 (Extração de Detalhes) concluída com sucesso!")
    except Exception as e:
        print(f"  ✗ Erro na FASE 2 (Detalhamento): {e}")

    if progress_callback:
        progress_callback({"etapa": "Executadas Concluídas", "progresso_pct": 100})

    print("\n" + "=" * 70)
    print(f"✨ CICLO DE EXECUTADAS CONCLUÍDO! — {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 70 + "\n")

def executar_ciclo_pendencias(dt_inicio, dt_fim, headless=True, cancel_event=None, progress_callback=None):
    """Executa apenas a FASE 2 (Pendências) e FASE 3 (Análise Preditiva)."""
    print("\n" + "=" * 70)
    print(f"🚀 CICLO ISOLADO: PENDÊNCIAS E INTELIGÊNCIA INICIADO — {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"   Período de Extração: {dt_inicio} até {dt_fim} | Modo Headless: {headless}")
    print("=" * 70)

    if progress_callback:
        progress_callback({"etapa": "Extraindo Solicitações Pendentes", "progresso_pct": 30})

    print("\n[FASE 1/2] 📂 Extraindo Solicitações Pendentes (4 Categorias -> Projeto 1)...")
    try:
        driver_path = funcoes.install_driver()
        funcoes.num_downloads = 0
        funcoes.dedos_extraidos = []

        for idx, f_id in enumerate(FILTROS_PENDENCIAS):
            if cancel_event and cancel_event.is_set():
                print("[CANCELADO] Extração cancelada pelo usuário.")
                break

            nome = NOMES_FILTROS[idx]
            if progress_callback:
                progress_callback({"etapa": f"Extraindo Pendências: {nome} ({idx+1}/4)", "progresso_pct": 30 + (idx * 12)})

            sucesso = False
            for tentativa in range(1, 3):
                print(f"  -> Extraindo {nome} ({idx+1}/4) - Tentativa {tentativa}...")
                try:
                    funcoes.definitiva(f_id, dt_inicio, dt_fim, driver_path=driver_path, headless=headless)
                    print(f"     ✓ {nome} extraído com sucesso na tentativa {tentativa}!")
                    sucesso = True
                    break
                except Exception as err:
                    print(f"     ⚠ Erro ao extrair {nome} na tentativa {tentativa}: {err}")
                    time.sleep(3)
            
            if not sucesso:
                print(f"     ❌ Falha definitiva ao extrair {nome} após 2 tentativas.")
        
        print("\n  Enviando solicitações pendentes ao Backend Express (Painel UMB)...")
        upload_supabase.upload_all()
        print("  ✓ FASE 1 (Pendências) concluída com sucesso!")
    except Exception as e:
        print(f"  ✗ Erro na FASE 1 (Pendências): {e}")

    if cancel_event and cancel_event.is_set():
        print("[CANCELADO] Execução interrompida antes da Análise Preditiva.")
        return

    if progress_callback:
        progress_callback({"etapa": "Calculando Análise Preditiva IA", "progresso_pct": 85})

    reprocessar_analise_preditiva()

    if progress_callback:
        progress_callback({"etapa": "Pendências Concluídas", "progresso_pct": 100})

    print("\n" + "=" * 70)
    print(f"✨ CICLO DE PENDÊNCIAS CONCLUÍDO! — {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 70 + "\n")

def executar_detalhes_isolado(dt_inicio=None, dt_fim=None, headless=True, cancel_event=None, progress_callback=None):
    """
    Executa EXCLUSIVAMENTE a extração de detalhes_os das SS que ainda não possuem detalhes.
    Ideal para integração futura quando os dados primários já estiverem no banco via Webhook.
    """
    print("\n" + "=" * 70)
    print(f"🎯 ATUALIZAÇÃO ISOLADA DE DETALHES DAS SS — {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"   Modo Headless: {headless}")
    print("=" * 70)

    if progress_callback:
        progress_callback({"etapa": "Consultando SSs sem detalhes no banco", "progresso_pct": 20})

    stats = detalhar_ss_os.processar_lote_banco(
        dt_inicio=dt_inicio, 
        dt_fim=dt_fim, 
        headless=headless, 
        cancel_event=cancel_event, 
        progress_callback=progress_callback
    )

    if progress_callback:
        progress_callback({"etapa": "Parseando HTMLs e gravando detalhes no banco", "progresso_pct": 80})

    extracao_de_detalhes.processar_htmls()

    if progress_callback:
        progress_callback({"etapa": "Detalhamento Concluído", "progresso_pct": 100, "stats": stats})

    print("\n" + "=" * 70)
    print(f"✨ ATUALIZAÇÃO DE DETALHES CONCLUÍDA! — {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 70 + "\n")
    return stats

def escolher_periodo():
    """Menu para escolha dinâmica de datas de extração."""
    print("\n  ========================================")
    print("  Escolha o período de extração (Dias):")
    print("    [2] Últimos 2 dias (Ontem e Hoje - Padrão)")
    print("    [3] Últimos 3 dias")
    print("    [7] Últimos 7 dias")
    print("    [C] Informar Data Customizada Inicial (Ex: 07/07/2026)")
    print("  ========================================")
    
    opcao_data = input("  Opção desejada (2, 3, 7 ou C): ").strip().upper()
    
    hoje = datetime.now()
    if opcao_data == "3":
        inicio = hoje - timedelta(days=2)
    elif opcao_data == "7":
        inicio = hoje - timedelta(days=6)
    elif opcao_data == "C":
        data_str = input("  Digite a data inicial no formato DD/MM/AAAA (ex: 09/08/2026): ").strip()
        try:
            inicio = datetime.strptime(data_str, "%d/%m/%Y")
        except ValueError:
            print("  ⚠️ Formato inválido! Usando o padrão (Últimos 2 dias).")
            inicio = hoje - timedelta(days=1)
    else:
        # Padrão ou opção 2: Últimos 2 dias
        inicio = hoje - timedelta(days=1)
        
    return inicio.strftime("%d/%m/%Y"), hoje.strftime("%d/%m/%Y")

def menu_principal():
    while True:
        print_banner()
        print("  Escolha o modo de operação:")
        print("    [1] Extração Única Completa (Pendências + Executadas + IA Preditiva)")
        print("    [2] Agendador Automático (Ciclo completo a cada 60 minutos)")
        print("    [3] Teste Isolado: Apenas Executadas (Saneaia) + Detalhes de Execução (HTML)")
        print("    [4] Teste Isolado: Apenas Pendências (Dashboard) + Análise Preditiva (IA)")
        print("    [5] Atualizar Detalhes das SS (Isolado) - Sem re-extração de listas")
        print("    [0] Sair")
        print("=" * 70)

        opcao = input("Opção desejada (0, 1, 2, 3, 4 ou 5): ").strip()

        if opcao == "1":
            dt_ini, dt_fim = escolher_periodo()
            print("\nIniciando Extração Única Completa...")
            executar_ciclo_completo(dt_ini, dt_fim)
            input("\nPressione ENTER para voltar ao menu...")
        elif opcao == "3":
            dt_ini, dt_fim = escolher_periodo()
            print("\nIniciando Extração de Executadas (Projeto 3) e Detalhes...")
            executar_ciclo_executadas(dt_ini, dt_fim)
            input("\nPressione ENTER para voltar ao menu...")
        elif opcao == "4":
            dt_ini, dt_fim = escolher_periodo()
            print("\nIniciando Extração de Pendências (Projeto 1) e Inteligência...")
            executar_ciclo_pendencias(dt_ini, dt_fim)
            input("\nPressione ENTER para voltar ao menu...")
        elif opcao == "5":
            print("\nIniciando Atualização Isolada de Detalhes das SS...")
            executar_detalhes_isolado()
            input("\nPressione ENTER para voltar ao menu...")
        elif opcao == "2":
            dt_ini, dt_fim = escolher_periodo()
            intervalo_min = 60
            print(f"\nIniciando Agendador Automático a cada {intervalo_min} minutos...")
            ciclo = 0
            while True:
                ciclo += 1
                print(f"\n{'#'*70}")
                print(f"# AGENDADOR: CICLO {ciclo} - {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
                print(f"{'#'*70}")
                executar_ciclo_completo(dt_ini, dt_fim)
                
                proxima = datetime.now() + timedelta(minutes=intervalo_min)
                print(f"⏱️ Próxima execução agendada para: {proxima.strftime('%H:%M:%S')}")
                print(f"   Aguardando {intervalo_min} minutos (Pressione Ctrl+C para parar o agendador)...\n")
                try:
                    time.sleep(intervalo_min * 60)
                except KeyboardInterrupt:
                    print("\n🛑 Agendador interrompido pelo usuário.")
                    break
        elif opcao == "0":
            print("\nEncerrando Sistema Mestre de Extração UMBMAS. Até logo!\n")
            break
        else:
            print("\n⚠️ Opção inválida! Escolha 1, 2, 3, 4, 5 ou 0.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="UMBMAS - Sistema Mestre de Extração")
    parser.add_argument("--routine", choices=["ciclo_completo", "executadas", "pendencias", "detalhes_isolado", "preditiva"], help="Rotina de extração a ser executada")
    parser.add_argument("--dt-inicio", help="Data de início (DD/MM/AAAA)")
    parser.add_argument("--dt-fim", help="Data de fim (DD/MM/AAAA)")
    parser.add_argument("--headless", action="store_true", default=True, help="Executar navegadores em segundo plano (padrão: True)")
    parser.add_argument("--no-headless", dest="headless", action="store_false", help="Exibir janelas dos navegadores")

    args = parser.parse_args()

    if args.routine:
        dt_ini = args.dt_inicio
        dt_fim = args.dt_fim
        if not dt_ini or not dt_fim:
            hoje = datetime.now()
            ontem = hoje - timedelta(days=1)
            dt_ini = ontem.strftime("%d/%m/%Y")
            dt_fim = hoje.strftime("%d/%m/%Y")

        if args.routine == "ciclo_completo":
            executar_ciclo_completo(dt_ini, dt_fim, headless=args.headless)
        elif args.routine == "executadas":
            executar_ciclo_executadas(dt_ini, dt_fim, headless=args.headless)
        elif args.routine == "pendencias":
            executar_ciclo_pendencias(dt_ini, dt_fim, headless=args.headless)
        elif args.routine == "detalhes_isolado":
            executar_detalhes_isolado(dt_ini, dt_fim, headless=args.headless)
        elif args.routine == "preditiva":
            reprocessar_analise_preditiva()
    else:
        menu_principal()
