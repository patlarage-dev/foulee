FROM python:3.13-slim-bookworm
ENV HOME=/home/foulee PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN useradd --uid 10001 --create-home foulee && mkdir -p "/home/foulee/Library/Application Support/Foulee" && chown -R foulee:foulee /home/foulee
WORKDIR /app
COPY app/ /app/
COPY backup.py /opt/backup.py
USER 10001:10001
EXPOSE 8765
CMD ["python", "serve_local.py"]
