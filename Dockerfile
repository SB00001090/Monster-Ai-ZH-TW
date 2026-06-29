FROM python:3.11-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt constraints.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY monster_ai ./monster_ai
COPY main.py config.docker.yaml ./
COPY scripts/docker-entrypoint.sh ./scripts/
RUN chmod +x ./scripts/docker-entrypoint.sh

ENV MONSTER_CONFIG=/app/config.docker.yaml
EXPOSE 7860

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["python", "main.py"]