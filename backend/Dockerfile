# VERDANT-X API: liboqs (ML-DSA) built from source, then the FastAPI app.
# Hosted demo runs on the in-memory chain: no keys, no gas, nothing for visitors to spend.

FROM public.ecr.aws/docker/library/python:3.12-slim AS liboqs
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake ninja-build git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch 0.16.0 https://github.com/open-quantum-safe/liboqs.git /src/liboqs \
    && cmake -S /src/liboqs -B /src/build -GNinja -DBUILD_SHARED_LIBS=ON -DOQS_BUILD_ONLY_LIB=ON -DOQS_USE_OPENSSL=OFF \
       -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/liboqs \
    && cmake --build /src/build && cmake --install /src/build

FROM public.ecr.aws/docker/library/python:3.12-slim
COPY --from=liboqs /opt/liboqs /opt/liboqs
ENV OQS_INSTALL_PATH=/opt/liboqs \
    LD_LIBRARY_PATH=/opt/liboqs/lib \
    PYTHONUNBUFFERED=1 \
    CHAIN_BACKEND=memory
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
# Render sets $PORT. One worker: demo state lives in memory.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
