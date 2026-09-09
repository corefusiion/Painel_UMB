# ==============================================================================
# Dockerfile - Webhook Receiver & Ingestão de Dados EMBASA
# Desenvolvido para: EMBASA - Unidade Metropolitana de Salvador / Buraquinho
# ==============================================================================

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV WEBHOOK_PORT=3002
ENV PYTHONUNBUFFERED=1

EXPOSE 3002

CMD ["python", "listener_recebimento.py"]
