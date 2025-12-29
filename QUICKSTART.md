# 🚀 Szybki Start - EcoScoot

## Wymagania wstępne

- Node.js 18+ 
- Redis (Docker lub lokalnie)
- DynamoDB (AWS lub lokalny)
- npm lub yarn

---

## 1. Uruchom Redis

### Przez Docker (zalecane):
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

### Lub lokalnie (jeśli masz zainstalowany):
```bash
redis-server
```

---

## 2. Skonfiguruj DynamoDB

### Opcja A: DynamoDB Local (deweloperskie)

```bash
docker run -d -p 8000:8000 --name dynamodb amazon/dynamodb-local
```

Następnie w pliku `.env` ustaw:
```env
DYNAMODB_ENDPOINT=http://localhost:8000
AWS_REGION=eu-central-1
```

### Opcja B: AWS DynamoDB (produkcyjne)

W pliku `.env` ustaw prawdziwe credentials:
```env
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=twój_klucz
AWS_SECRET_ACCESS_KEY=twój_sekret
# NIE ustawiaj DYNAMODB_ENDPOINT
```

---

## 3. Backend - Instalacja i Uruchomienie

```bash
cd backend

# Zainstaluj zależności
npm install

# Skopiuj .env.example jako .env
cp .env.example .env
# LUB na Windows:
copy .env.example .env

# Edytuj .env i ustaw zmienne

# Zainicjalizuj tabele DynamoDB
npm run db:init

# Wygeneruj przykładowe dane
npm run db:seed

# Uruchom serwer deweloperski
npm run dev
```

Backend będzie dostępny pod: **http://localhost:5000**

---

## 4. Frontend - Instalacja i Uruchomienie

**WAŻNE:** Przed uruchomieniem frontendu musisz:
1. Uruchomić backend (krok 3)
2. Zainicjalizować tabele (`npm run db:init`)
3. Załadować dane testowe (`npm run db:seed`)

```bash
cd frontend

# Zainstaluj zależności
npm install

# Uruchom serwer deweloperski
npm run dev
```

Frontend będzie dostępny pod: **http://localhost:3000**

---

## 5. Logowanie

### Konta testowe (utworzone przez `npm run db:seed`):

**Administrator:**
- Email: `admin@ecoscoot.pl`
- Hasło: `password123`
- Uprawnienia: Pełny dostęp

**Użytkownik 1:**
- Email: `jan.kowalski@example.com`
- Hasło: `password123`

**Użytkownik 2:**
- Email: `anna.nowak@example.com`
- Hasło: `password123`

**Użytkownik 3:**
- Email: `piotr.wisniewski@example.com`
- Hasło: `password123`

---

## 🐛 Rozwiązywanie Problemów

### Problem: "Cannot do operations on a non-existent table"

**Rozwiązanie:** Musisz najpierw zainicjalizować tabele!

```bash
cd backend
npm run db:init
```

### Problem: "Redis connection failed"

**Rozwiązanie:** Upewnij się że Redis działa:

```bash
# Sprawdź czy Redis działa
redis-cli ping
# Powinno zwrócić: PONG

# Jeśli nie działa, uruchom:
docker start redis
# lub
docker run -d -p 6379:6379 --name redis redis:latest
```

### Problem: "DynamoDB connection failed"

**Rozwiązanie dla DynamoDB Local:**
```bash
# Sprawdź czy kontener działa
docker ps

# Jeśli nie, uruchom:
docker start dynamodb
# lub
docker run -d -p 8000:8000 --name dynamodb amazon/dynamodb-local
```

**Rozwiązanie dla AWS DynamoDB:**
- Sprawdź credentials w `.env`
- Upewnij się że masz dostęp do regionu `eu-central-1`
- Sprawdź czy DYNAMODB_ENDPOINT NIE jest ustawiony

### Problem: Frontend nie widzi backendu

**Rozwiązanie:**
1. Sprawdź czy backend działa: http://localhost:5000/health
2. Sprawdź proxy w `frontend/vite.config.js`
3. Restartuj frontend: `Ctrl+C` i ponownie `npm run dev`

---

## 📝 Kolejność Uruchamiania

**Zawsze stosuj tę kolejność:**

1. ✅ Uruchom Redis
2. ✅ Uruchom DynamoDB
3. ✅ Uruchom backend (`npm run dev`)
4. ✅ Zainicjalizuj tabele (`npm run db:init`) - **tylko raz**
5. ✅ Załaduj dane testowe (`npm run db:seed`) - **tylko raz lub gdy chcesz zresetować**
6. ✅ Uruchom frontend (`npm run dev`)
7. ✅ Otwórz http://localhost:3000
8. ✅ Zaloguj się (np. `admin@ecoscoot.pl` / `password123`)

---

## 🎯 Szybki Test

Po uruchomieniu wszystkiego:

1. Otwórz http://localhost:3000
2. Kliknij "👑 Administrator" aby wypełnić dane logowania
3. Kliknij "Zaloguj się"
4. Powinieneś zobaczyć mapę Krakowa z 50 hulajnogami

---

## 📚 Więcej Informacji

- **Backend README:** `backend/README.md`
- **Dokumentacja API:** Sprawdź backend/README.md dla pełnej listy endpointów
- **Frontend:** Używa React + Vite + Leaflet
- **Backend:** Node.js + Express + DynamoDB + Redis

---

## 🆘 Nadal masz problemy?

1. Sprawdź czy wszystkie porty są wolne:
   - **3000** - Frontend
   - **5000** - Backend
   - **6379** - Redis
   - **8000** - DynamoDB Local

2. Sprawdź logi:
   - Backend: Terminal gdzie uruchomiłeś `npm run dev`
   - Redis: `docker logs redis`
   - DynamoDB: `docker logs dynamodb`

3. Reset wszystkiego:
   ```bash
   # Backend
   cd backend
   npm run db:init:reset  # Usuwa i tworzy tabele od nowa
   npm run db:seed        # Generuje nowe dane
   
   # Restart serwerów
   # Ctrl+C w terminalach i ponownie npm run dev
   ```

---

**Powodzenia! 🛴**