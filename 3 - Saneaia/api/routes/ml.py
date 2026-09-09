from fastapi import APIRouter, Query
from typing import Optional
from api.ml.clustering import HydraulicClusterer

router = APIRouter(prefix="/api/ml", tags=["Inteligência Operacional (ML)"])

@router.get("/events")
async def get_ml_events(
    hours: int = Query(default=48, ge=1, le=168),
    limit: int = Query(default=80, ge=1, le=200),
):
    """Retorna eventos detectados pelo motor de clustering (limitados para não sobrecarregar o frontend)."""
    clusterer = HydraulicClusterer()
    data = await clusterer.get_recent_data(hours=hours)
    print(f"[DEBUG] ml/events: {len(data)} rows fetched")
    events = clusterer.detect_events(data)
    print(f"[DEBUG] ml/events: {len(events)} events detected")
    
    # Limitar para evitar payload gigante: prioriza masters, depois isolados
    masters = [e for e in events if e["type"] == "MASTER_EVENT"][:50]
    isolated = [e for e in events if e["type"] == "ISOLATED_DIAGNOSTIC"][:30]
    limited = masters + isolated
    
    return {
        "count": len(events),
        "showing": len(limited),
        "events": limited
    }

import os
import sqlite3
import pandas as pd
from fastapi import BackgroundTasks
from pydantic import BaseModel
import pickle
import json
from datetime import datetime

# Machine Learning imports
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, precision_score, recall_score

class MLResponse(BaseModel):
    status: str
    message: str
    metrics: dict = None
    predictions: int = 0

def get_db_path():
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "database", "saneaia.db"))

def get_model_paths():
    ml_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "ml", "models"))
    os.makedirs(ml_dir, exist_ok=True)
    return os.path.join(ml_dir, "random_forest_prod.pkl"), os.path.join(ml_dir, "rf_metrics.json"), os.path.join(ml_dir, "label_encoders.pkl")

def init_db():
    conn = sqlite3.connect(get_db_path())
    conn.execute('''
        CREATE TABLE IF NOT EXISTS model_training_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            treinado_em TEXT,
            acuracia REAL,
            precisao REAL,
            recall REAL,
            amostras INTEGER,
            status TEXT,
            mensagem_erro TEXT
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS predicoes_ml (
            solicitacao_id TEXT PRIMARY KEY,
            probabilidade_falha REAL,
            risco TEXT,
            data_predicao TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

training_state = {
    "is_training": False,
    "progress": 0,
    "step": "Aguardando inicialização...",
    "error": None
}

def train_random_forest_task():
    """Treina um modelo Random Forest real com dados do SQLite (Background Task) e tracking de progresso."""
    global training_state
    training_state["is_training"] = True
    training_state["progress"] = 5
    training_state["step"] = "Conectando ao banco de dados SQLite..."
    training_state["error"] = None
    
    try:
        db_path = get_db_path()
        conn = sqlite3.connect(db_path)
        
        training_state["progress"] = 15
        training_state["step"] = "Lendo milhares de ordens de serviço históricas..."
        df = pd.read_sql_query("SELECT bairro, servico, especificacao, situacao FROM solicitacoes WHERE situacao IS NOT NULL AND situacao != '' AND situacao NOT IN ('ABERTA', 'PROGRAMADA')", conn)
        
        print(f"\n[AUDITORIA ML] ===========================================")
        print(f"[AUDITORIA ML] Shape real da matriz lida do SQLite: {df.shape}")
        
        if len(df) < 10:
            raise Exception("Dados insuficientes para treinar o modelo. (Mínimo de registros concluídos não atingido)")

        training_state["progress"] = 30
        training_state["step"] = "Limpando dados e extraindo features (Engenharia de Recursos)..."
        df['bairro'] = df['bairro'].fillna('DESCONHECIDO').astype(str)
        df['servico'] = df['servico'].fillna('DESCONHECIDO').astype(str)
        
        df['target'] = df['situacao'].str.upper().apply(
            lambda x: 0 if 'NÃO EXECUTAD' in x or 'NAO EXECUTAD' in x or 'CANCELAD' in x else 1
        )

        training_state["progress"] = 45
        training_state["step"] = "Aplicando codificação matemática aos Bairros e Serviços (Label Encoding)..."
        le_bairro = LabelEncoder()
        le_servico = LabelEncoder()
        
        df['bairro_encoded'] = le_bairro.fit_transform(df['bairro'])
        df['servico_encoded'] = le_servico.fit_transform(df['servico'])
        
        X = df[['bairro_encoded', 'servico_encoded']]
        y = df['target']
        
        print(f"[AUDITORIA ML] Amostra de colunas utilizadas (X): {list(X.columns)}")
        print(f"[AUDITORIA ML] Target (y): Distribuição de classes: \n{y.value_counts().to_string()}")

        training_state["progress"] = 50
        training_state["step"] = "Dividindo amostras (80% Treino / 20% Teste)..."
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        training_state["progress"] = 60
        training_state["step"] = "Iniciando treinamento da IA (Scikit-Learn Random Forest)..."
        
        rf_model = RandomForestClassifier(n_estimators=10, warm_start=True, max_depth=10, random_state=42, n_jobs=-1)
        for i in range(1, 11):
            rf_model.n_estimators = i * 10
            rf_model.fit(X_train, y_train)
            training_state["progress"] = 60 + (i * 3) # Sobe de 60 até 90%
            training_state["step"] = f"Construindo Floresta de Decisão: {i*10}% das árvores criadas..."

        training_state["progress"] = 92
        training_state["step"] = "Avaliando e calculando Métricas de Desempenho (Acurácia/Precision/Recall)..."
        y_pred = rf_model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, zero_division=0)
        recall = recall_score(y_test, y_pred, zero_division=0)

        training_state["progress"] = 96
        training_state["step"] = "Salvando modelo binário (.pkl) e atualizando o Histórico..."
        model_path, metrics_path, encoders_path = get_model_paths()
        
        with open(model_path, 'wb') as f:
            pickle.dump(rf_model, f)
        with open(encoders_path, 'wb') as f:
            pickle.dump({'bairro': le_bairro, 'servico': le_servico}, f)
            
        print(f"[AUDITORIA ML] Modelo físico exportado com sucesso para: {model_path}")
        print(f"[AUDITORIA ML] ===========================================\n")
        
        metrics = {
            "accuracy": round(accuracy * 100, 2),
            "precision": round(precision * 100, 2),
            "recall": round(recall * 100, 2),
            "last_trained": datetime.now().isoformat(),
            "samples_used": len(df),
            "algorithm": "Random Forest (Scikit-Learn)"
        }
        
        with open(metrics_path, 'w') as f:
            json.dump(metrics, f)

        conn.execute('''
            INSERT INTO model_training_history (treinado_em, acuracia, precisao, recall, amostras, status)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (metrics["last_trained"], metrics["accuracy"], metrics["precision"], metrics["recall"], len(df), "SUCESSO"))
        conn.commit()
        conn.close()

        training_state["progress"] = 100
        training_state["step"] = "Treinamento Finalizado com Sucesso!"
        print(f"[ML] Modelo retreinado com sucesso. Acurácia: {accuracy:.2f}")

    except Exception as e:
        print(f"[ML ERROR] Erro no treinamento: {e}")
        training_state["error"] = str(e)
        training_state["step"] = "Falha crítica no processamento."
        try:
            conn = sqlite3.connect(get_db_path())
            conn.execute('''
                INSERT INTO model_training_history (treinado_em, status, mensagem_erro)
                VALUES (?, ?, ?)
            ''', (datetime.now().isoformat(), "FALHA", str(e)))
            conn.commit()
            conn.close()
        except:
            pass
    finally:
        training_state["is_training"] = False

@router.post("/train")
async def api_train_model(background_tasks: BackgroundTasks):
    """Dispara o pipeline de treinamento de Machine Learning de forma assíncrona (Background Task)"""
    global training_state
    if training_state["is_training"]:
        return {"status": "processing", "message": "Um treinamento já está em andamento."}
    
    background_tasks.add_task(train_random_forest_task)
    return {"status": "processing", "message": "Treinamento iniciado."}

@router.get("/progress")
async def get_training_progress():
    """Retorna o percentual e o passo atual do treinamento do modelo."""
    return training_state

@router.get("/status")
async def get_model_status():
    """Retorna o status atual do modelo em produção"""
    _, metrics_path, _ = get_model_paths()
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            return json.load(f)
    return {"message": "Nenhum modelo treinado ainda", "accuracy": 0}

@router.get("/history")
async def get_model_history():
    """Retorna o histórico de treinamentos para alimentar gráficos"""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM model_training_history ORDER BY id DESC LIMIT 20").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/predict", response_model=MLResponse)
async def api_run_predictions():
    """Executa o modelo preditivo para as OSs Abertas/Programadas"""
    try:
        model_path, metrics_path, encoders_path = get_model_paths()
        if not os.path.exists(model_path) or not os.path.exists(encoders_path):
            return MLResponse(status="error", message="Modelo não treinado. Execute o treinamento primeiro.")

        with open(model_path, 'rb') as f:
            rf_model = pickle.load(f)
            
        with open(encoders_path, 'rb') as f:
            encoders = pickle.load(f)
            le_bairro = encoders['bairro']
            le_servico = encoders['servico']

        db_path = get_db_path()
        conn = sqlite3.connect(db_path)
        df_abertas = pd.read_sql_query("SELECT id, bairro, servico FROM solicitacoes WHERE situacao IN ('ABERTA', 'PROGRAMADA')", conn)
        
        if len(df_abertas) == 0:
            conn.close()
            return MLResponse(status="success", message="Nenhuma OS Aberta para prever", predictions=0)

        df_abertas['bairro'] = df_abertas['bairro'].fillna('DESCONHECIDO').astype(str)
        df_abertas['servico'] = df_abertas['servico'].fillna('DESCONHECIDO').astype(str)

        df_abertas['bairro_encoded'] = df_abertas['bairro'].apply(lambda x: le_bairro.transform([x])[0] if x in le_bairro.classes_ else -1)
        df_abertas['servico_encoded'] = df_abertas['servico'].apply(lambda x: le_servico.transform([x])[0] if x in le_servico.classes_ else -1)

        X_pred = df_abertas[['bairro_encoded', 'servico_encoded']]
        probs = rf_model.predict_proba(X_pred)
        
        df_abertas['prob_falha'] = (1.0 - probs[:, 1]) * 100
        
        now = datetime.now().isoformat()
        cursor = conn.cursor()
        for _, row in df_abertas.iterrows():
            prob = row['prob_falha']
            risco = "ALTO" if prob >= 70 else ("MÉDIO" if prob >= 40 else "BAIXO")
            cursor.execute('''
                INSERT INTO predicoes_ml (solicitacao_id, probabilidade_falha, risco, data_predicao)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(solicitacao_id) DO UPDATE SET
                probabilidade_falha=excluded.probabilidade_falha,
                risco=excluded.risco,
                data_predicao=excluded.data_predicao
            ''', (row['id'], prob, risco, now))
            
        conn.commit()
        conn.close()

        with open(metrics_path, 'r') as f:
            metrics = json.load(f)

        return MLResponse(
            status="success", 
            message="Predições geradas e salvas com sucesso", 
            predictions=len(df_abertas),
            metrics=metrics
        )
    except Exception as e:
        print(f"[ML ERROR] Erro na predição: {e}")
        return MLResponse(status="error", message=str(e))
