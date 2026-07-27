# Standart x86_64 Linux sunucusu icin - Termux/Android'deki gibi ARM
# derleme sorunlari burada YASANMAZ, numpy/pandas/scipy/scikit-learn/
# hmmlearn'in hepsinin PyPI'da hazir (derlenmis) kopyalari var.
FROM python:3.11-slim

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir yfinance pandas numpy scipy scikit-learn hmmlearn requests

CMD ["python", "mobil_calistir.py"]
