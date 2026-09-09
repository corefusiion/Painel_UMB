# Usar imagem oficial do Python estável
FROM python:3.11-slim

# Definir diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema necessárias (para Pandas e outras libs científicas se necessário)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar apenas os requisitos primeiro para aproveitar o cache do Docker
COPY requirements.txt .

# Instalar dependências do Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o restante do código do projeto
COPY . .

# Expor a porta que o FastAPI usa
EXPOSE 8000

# Comando para rodar a aplicação
CMD ["python", "main.py"]
