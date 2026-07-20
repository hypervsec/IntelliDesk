# IntelliDesk RAG Testleri

Bu klasör, IntelliDesk yapay zekâ öneri sisteminin sıralama davranışını koruyan otomatik regresyon testlerini içerir.

## Testlerin Amacı

RAG sıralama algoritmasında yapılan değişikliklerin daha önce doğru çalıştığı doğrulanan örnekleri bozmamasını kontrol eder.

Mevcut test senaryoları:

- DECT telefon sorgusunda `21373` numaralı geçmiş ticketın ilk sırada bulunması
- Yazıcı görüntüleme birimi sorgusunda `17832` numaralı geçmiş ticketın ilk sırada bulunması
- Sonuç sayısının belirlenen limit değerini aşmaması
- Dönen çözüm metninin beklenen anahtar ifadeleri içermesi

## Gereksinimler

Testler çalıştırılmadan önce:

- PostgreSQL çalışıyor olmalıdır.
- Proje veritabanı `5433` portundan erişilebilir olmalıdır.
- `backend/.env` dosyası bulunmalıdır.
- `rag_ticket_data` tablosunda geçmiş kayıtlar bulunmalıdır.
- `ticket_embeddings` tablosunda embedding kayıtları bulunmalıdır.
- Eksik embedding sayısı `0` olmalıdır.

Gerçek veritabanı parolası hiçbir test dosyasına yazılmamalıdır.

## Geliştirme Bağımlılıklarını Kurma

Sanal ortam açıkken backend klasöründe:

```powershell
cd C:\Users\enesm\Desktop\IntelliDesk\backend

python -m pip install -r requirements-dev.txt
```

## Tüm Testleri Çalıştırma

```powershell
cd C:\Users\enesm\Desktop\IntelliDesk\backend

python -m pytest -v
```

## Yalnızca RAG Testlerini Çalıştırma

```powershell
python -m pytest tests\test_rag_ranking.py -v
```

## Syntax Kontrolüyle Birlikte Çalıştırma

```powershell
python -m compileall app tests

python -m pytest -v
```

## Beklenen Sonuç

```text
tests/test_rag_ranking.py::test_dect_ticket_ranking PASSED
tests/test_rag_ranking.py::test_printer_imaging_unit_ranking PASSED

2 passed
```

## Önemli Notlar

- Testler yerel PostgreSQL veritabanını kullanır.
- Testler sırasında embedding modeli belleğe yüklenir.
- İlk çalıştırmada model dosyalarının indirilmesi zaman alabilir.
- HF Hub kimlik doğrulama uyarısı testlerin başarısız olduğu anlamına gelmez.
- Test verilerinin silinmesi veya değiştirilmesi beklenen sıralamayı etkileyebilir.
- `.env`, veritabanı parolası veya API anahtarları GitHub'a gönderilmemelidir.
