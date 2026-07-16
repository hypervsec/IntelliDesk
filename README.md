# IntelliDesk

IntelliDesk, geçmiş Service Desk ticketlarını ve çözüm kayıtlarını kullanarak yeni destek taleplerine benzer çözümler önermeyi amaçlayan yapay zekâ destekli bir yardım masası uygulamasıdır.

## Özellikler

- Ticket oluşturma, listeleme ve detay görüntüleme
- Arama, filtreleme, sıralama ve sayfalama
- Departman, kategori ve alt kategori seçimi
- Dashboard ve temel istatistikler
- Benzer ticket arama
- Yapay zekâ destekli çözüm önerisi
- AI güven puanı ve kullanıcı geri bildirimi

## Kullanılan Teknolojiler

### Backend
- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- pgvector

### Frontend
- React
- Vite
- Axios
- React Router

## Kurulum

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API dokümantasyonu:

```text
http://127.0.0.1:8000/docs
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend adresi:

```text
http://localhost:5173
```

## Proje Durumu

Proje aktif olarak geliştirilmektedir.

Planlanan geliştirmeler:

- Kullanıcı girişi ve yetkilendirme
- Teknik personel yönetimi
- Bildirim sistemi
- Dosya ekleme desteği
- Raporlama ve Docker desteği

> `.env` dosyaları, API anahtarları ve veritabanı şifreleri GitHub'a gönderilmemelidir.
