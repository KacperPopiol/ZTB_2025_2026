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

