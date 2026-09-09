import funcoes
import threading
from datetime import datetime, timedelta
import time
import tkinter as tk
from tkinter import ttk
import upload_supabase

# Acessar o filtro salvo
filtro = ["form-filtroAcss-dlgFilterPrefs-tableUser-4-j_idt341",
          "form-filtroAcss-dlgFilterPrefs-tableUser-5-j_idt341",
          "form-filtroAcss-dlgFilterPrefs-tableUser-6-j_idt341",
          "form-filtroAcss-dlgFilterPrefs-tableUser-3-j_idt341"]

# Definindo função que será executada após o clique no botão "Iniciar"


def iniciar_processo():
    # Obtendo os valores das datas dos campos de entrada ou calculando os últimos 2 dias automaticamente (ontem e hoje)
    dt_ontem = (datetime.now() - timedelta(days=1)).strftime("%d/%m/%Y")
    dt_hoje = datetime.now().strftime("%d/%m/%Y")
    
    data_inicio_str = data_inicio.get().strip() if (data_inicio and data_inicio.get().strip()) else dt_ontem
    data_fim_str = data_fim.get().strip() if (data_fim and data_fim.get().strip()) else dt_hoje

    # Resetar contagem
    funcoes.num_downloads = 0
    funcoes.dedos_extraidos = []

    # Iniciando processo em threads com as datas diretas (sem reparticionamento)
    threads = [
        threading.Thread(target=funcoes.definitiva, args=[filtro[0], data_inicio_str, data_fim_str]),
        threading.Thread(target=funcoes.definitiva, args=[filtro[1], data_inicio_str, data_fim_str]),
        threading.Thread(target=funcoes.definitiva, args=[filtro[2], data_inicio_str, data_fim_str]),
        threading.Thread(target=funcoes.definitiva, args=[filtro[3], data_inicio_str, data_fim_str])
    ]

    for t in threads:
        t.start()

    # Exibindo mensagem de aguardar e iniciando barra de progresso
    status_label.config(text='Processando extração...')
    progresso['maximum'] = 100
    progresso['value'] = 0

    while True:
        if all(not t.is_alive() for t in threads):
            break
        else:
            # Atualizar progresso baseado no número de downloads
            progresso['value'] = min(len(funcoes.dedos_extraidos) * 10, 100)
            janela.update()
            time.sleep(0.1)

    # Extração finalizada — agora enviar ao Supabase
    status_label.config(text='Enviando dados ao Supabase...')
    progresso['value'] = 90
    janela.update()

    try:
        inserted, errors = upload_supabase.upload_all()
        if errors == 0:
            status_label.config(text=f'✓ Concluído! {inserted} registros enviados ao Supabase')
        else:
            status_label.config(text=f'⚠ Concluído com {errors} erros. {inserted} registros enviados.')
    except Exception as e:
        status_label.config(text=f'✗ Erro no upload: {str(e)[:50]}')
        print(f"Erro no upload Supabase: {e}")

    progresso['value'] = 100


# Criando janela
janela = tk.Tk()
janela.configure(bg="#fff")
janela.title("Extração de Dados!")


# adicionar imagem da empresa
img = tk.PhotoImage(file="")
tk.Label(janela, image=img, bg="#FFF").place(x=10, y=10)


# Definindo dimensões da janela
largura = 400
altura = 250

# Obtendo resolução do sistema
largura_tela = janela.winfo_screenwidth()
altura_tela = janela.winfo_screenheight()

# Calculando posição da janela na tela
x = largura_tela/2 - largura/2
y = altura_tela/2 - altura/2

# Definindo geometria da janela
# janela.geometry('%dx%d+%d+%d' % (largura, altura, x, y))
janela.geometry("500x300")

# Criando entrada de data de início
data_inicio_label = tk.Label(janela, text='Data de Início:')
# data_inicio_label.pack(pady=10)
data_inicio_label.place(x=350, y=20)

data_inicio = tk.Entry(janela)
data_inicio.insert(0, (datetime.now() - timedelta(days=1)).strftime("%d/%m/%Y"))
data_inicio.place(x=350, y=40)

# Criando entrada de data de fim
data_fim_label = tk.Label(janela, text='Data de Fim:')
data_fim_label.place(x=350, y=70)

data_fim = tk.Entry(janela)
data_fim.insert(0, datetime.now().strftime("%d/%m/%Y"))
data_fim.place(x=350, y=90)

# Criando botão de iniciar
iniciar_botao = tk.Button(
    janela, text="Iniciar", command=iniciar_processo, width=10, height=2, bg='lightblue')
# iniciar_botao.pack(pady=10)
iniciar_botao.place(x=350, y=120, height=25)


# Criando label para exibir status
status_label = tk.Label(janela, text='')
status_label.pack()

# Criando barra de progresso
progresso = ttk.Progressbar(janela, mode='determinate', maximum=100)
# progresso.pack(pady=10)
progresso.place(width=300, relx=0.5, rely=0.9, anchor='center')

# Exibindo janela
janela.mainloop()
