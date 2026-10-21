FROM python:3.12-slim
WORKDIR /app
COPY bot.py ./
COPY data ./data
ENV PORT=8080
EXPOSE 8080
CMD ["python", "-u", "bot.py"]
