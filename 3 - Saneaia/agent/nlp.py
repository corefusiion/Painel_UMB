"""Modulo NLP com categorizacao tecnica e extracao de logradouros."""

import re
from collections import Counter


# === Categorias Tecnicas ===
TECHNICAL_CATEGORIES = {
    "REDE_DISTRIBUICAO": {
        "keywords": [
            "vazamento", "vazando", "vaza", "estourou", "estourada", "rompimento",
            "baixa pressao", "pressao baixa", "sem pressao", "pouca pressao",
            "falta de agua", "falta d'agua", "faltando agua", "sem agua",
            "agua suja", "agua escura", "agua amarela", "turbidez",
            "tubulacao", "cano", "ramal", "rede rompida", "rede estourada",
            "agua jorrando", "desperdicio",
        ],
        "label": "Rede de Distribuicao",
    },
    "COMERCIAL_MEDICAO": {
        "keywords": [
            "hidrometro", "hidrometro", "medidor", "relogio",
            "leitura", "conta", "fatura", "cobranca",
            "lacre", "cavalete", "registro",
            "ligacao", "corte", "religacao", "supressao",
        ],
        "label": "Comercial/Medicao",
    },
    "ESGOTAMENTO": {
        "keywords": [
            "esgoto", "obstrucao", "obstruido", "entupido", "entupimento",
            "extravasamento", "extravasando", "transbordando", "retorno",
            "mau cheiro", "mal cheiro", "fedor", "odor",
            "pv ", "poco de visita", "bueiro", "boca de lobo",
            "rede coletora", "fossa",
        ],
        "label": "Esgotamento Sanitario",
    },
    "MANUTENCAO": {
        "keywords": [
            "substituicao", "troca", "reparo", "conserto",
            "preventiva", "inspecao", "vistoria", "geofonamento",
            "reforma", "adequacao",
        ],
        "label": "Manutencao Preventiva",
    },
}


# === Sentimento ===
NEGATIVE_KEYWORDS = [
    "reclam", "denuncia", "urgente", "emergencia", "critico", "grave",
    "perigo", "risco", "prejudic", "insatisf", "absurdo", "descaso",
    "nunca", "pessimo", "horrivel", "demorand", "nao resolve", "sem solucao",
    "varios dias", "semanas", "meses", "faz tempo", "recorrente",
]

POSITIVE_KEYWORDS = [
    "resolvido", "concluido", "solucionado", "normalizado", "funcionando",
    "atendido", "rapido", "eficiente",
]

URGENCY_KEYWORDS = [
    "urgente", "emergencia", "critico", "imediato", "perigo", "risco",
    "alagamento", "inundacao", "desabamento", "contaminacao",
    "idoso", "crianca", "hospital", "escola", "creche",
]


def categorize_technical(text: str) -> str:
    """Categoriza o problema em categoria tecnica real."""
    if not text:
        return "NAO_CLASSIFICADO"

    text_lower = text.lower()

    best_match = "NAO_CLASSIFICADO"
    best_score = 0

    for cat_id, cat_info in TECHNICAL_CATEGORIES.items():
        score = sum(1 for kw in cat_info["keywords"] if kw in text_lower)
        if score > best_score:
            best_score = score
            best_match = cat_id

    return best_match


def categorize_from_fields(tipo: str = "", especificacao: str = "", observacao: str = "") -> dict:
    """Categoriza usando todos os campos disponiveis."""
    combined = f"{tipo} {especificacao} {observacao}".strip()
    category = categorize_technical(combined)

    return {
        "categoria": category,
        "label": TECHNICAL_CATEGORIES.get(category, {}).get("label", "Nao Classificado"),
        "source_text": combined[:200],
    }


def extract_location_from_text(text: str) -> dict:
    """Extrai informacoes de logradouro do texto de observacao."""
    if not text:
        return {"logradouro": None, "numero": None, "referencia": None}

    text_upper = text.upper()

    # Padroes de logradouro
    patterns = [
        r'(?:RUA|R\.)\s+([A-Z\s\d]+?)(?:\s*,|\s*N[°oO]|\s*-|\s*BAIRRO|\s*$)',
        r'(?:AVENIDA|AV\.?)\s+([A-Z\s\d]+?)(?:\s*,|\s*N[°oO]|\s*-|\s*BAIRRO|\s*$)',
        r'(?:TRAVESSA|TV\.?)\s+([A-Z\s\d]+?)(?:\s*,|\s*N[°oO]|\s*-|\s*BAIRRO|\s*$)',
        r'(?:PRACA|PCA\.?)\s+([A-Z\s\d]+?)(?:\s*,|\s*N[°oO]|\s*-|\s*BAIRRO|\s*$)',
        r'(?:ALAMEDA|AL\.?)\s+([A-Z\s\d]+?)(?:\s*,|\s*N[°oO]|\s*-|\s*BAIRRO|\s*$)',
        r'(?:LADEIRA|LAD\.?)\s+([A-Z\s\d]+?)(?:\s*,|\s*N[°oO]|\s*-|\s*BAIRRO|\s*$)',
    ]

    logradouro = None
    for pattern in patterns:
        match = re.search(pattern, text_upper)
        if match:
            logradouro = match.group(1).strip()[:80]
            break

    # Numero
    numero_match = re.search(r'N[°oO\.]*\s*(\d+)', text_upper)
    numero = numero_match.group(1) if numero_match else None

    # Referencia
    ref_match = re.search(r'(?:PROXIMO|PERTO|ENTRE|FRENTE|ESQUINA|CRUZAMENTO)\s+(.+?)(?:\.|,|$)', text_upper)
    referencia = ref_match.group(1).strip()[:100] if ref_match else None

    return {
        "logradouro": logradouro,
        "numero": numero,
        "referencia": referencia,
    }


def analyze_sentiment(text: str) -> str:
    """Analisa sentimento do texto."""
    if not text:
        return "neutro"

    text_lower = text.lower()
    neg = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text_lower)
    pos = sum(1 for kw in POSITIVE_KEYWORDS if kw in text_lower)

    if neg > pos:
        return "negativo"
    elif pos > neg:
        return "positivo"
    return "neutro"


def detect_urgency(text: str) -> bool:
    """Detecta urgencia no texto."""
    if not text:
        return False
    text_lower = text.lower()
    return any(kw in text_lower for kw in URGENCY_KEYWORDS)


def batch_analyze(observations: list[str]) -> dict:
    """Analise batch de observacoes com categorizacao tecnica."""
    if not observations:
        return {}

    sentiments = []
    urgencies = []
    categories = Counter()
    locations_found = 0

    for obs in observations:
        sentiments.append(analyze_sentiment(obs))
        urgencies.append(detect_urgency(obs))
        cat = categorize_technical(obs)
        categories[cat] += 1
        loc = extract_location_from_text(obs)
        if loc["logradouro"]:
            locations_found += 1

    total = len(observations)
    sent_counts = Counter(sentiments)

    return {
        "total_analisadas": total,
        "sentimento": {
            "positivo": sent_counts.get("positivo", 0),
            "negativo": sent_counts.get("negativo", 0),
            "neutro": sent_counts.get("neutro", 0),
        },
        "percentual_negativo": round(sent_counts.get("negativo", 0) / total * 100, 1) if total else 0,
        "percentual_positivo": round(sent_counts.get("positivo", 0) / total * 100, 1) if total else 0,
        "total_urgentes": sum(urgencies),
        "taxa_urgencia": round(sum(urgencies) / total * 100, 1) if total else 0,
        "categorias_tecnicas": dict(categories.most_common()),
        "logradouros_identificados": locations_found,
        "taxa_localizacao": round(locations_found / total * 100, 1) if total else 0,
    }
