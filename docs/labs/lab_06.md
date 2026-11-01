# Лабораторна робота №6: Контейнеризація та Docker Compose

**Мета:** Налаштувати Docker-оточення, контейнеризувати фронтенд і бекенд та запустити повний стек застосунку (клієнт + API + PostgreSQL) однією командою через Docker Compose.

---

## 1. Що було зроблено

1. **Очищено сміття після попередньої спроби:**
   - Видалено порожню некоректну папку `backend/db-init/init.sql/` (папку-фантом, яку створив Docker при помилковому монтуванні).
   - Видалено порожню папку `docs/labs/Lab_06`.
   - Видалено тимчасовий `init.sql` з кореня репозиторію.

2. **Організовано ініціалізацію БД:**
   - Створено файл [`backend/database/init.sql`](../../backend/database/init.sql) з повною DDL-схемою (`items`, `users`, `pages`, `blocks`) та початковими seed-даними.
   - Завдяки цьому при піднятті контейнера PostgreSQL база автоматично ініціалізується, і ендпоінти API (`/items`, `/pages`) не видають помилок 500.

3. **Створено файли контейнеризації:**
   - [`.dockerignore`](../../.dockerignore) у корені проєкту — відсікає `node_modules`, `.git`, `.env` та кеші.
   - [`backend/Dockerfile`](../../backend/Dockerfile) — збірка Node.js API на базі `node:20-alpine` з кешуванням залежностей (`npm ci --omit=dev`).
   - [`web/Dockerfile`](../../web/Dockerfile) — роздача статичного фронтенду на базі `nginx:alpine`.

4. **Налаштовано оркестрацію ([`docker-compose.yml`](../../docker-compose.yml)):**
   - **`web`** (порт `3000:80`) — веб-клієнт на Nginx.
   - **`api`** (порт `8080:8080`) — REST API на Node.js Express.
   - **`db`** (порт `5432:5432`) — PostgreSQL 15 з `healthcheck` (`pg_isready`) та монтуванням `./backend/database/init.sql`.
   - Сервіс `api` стартує строго після того, як база перейшла у стан `healthy`.

---

## 2. Як запустити проєкт

### Повний стек через Docker Compose (рекомендовано)

```bash
# 1. Запустити всі сервіси у фоновому режимі зі збіркою
docker compose up -d --build

# 2. Перевірити статус контейнерів
docker compose ps
```

Після запуску доступні:
- **Веб-інтерфейс:** [http://localhost:3000](http://localhost:3000)
- **API Health Check:** `curl http://localhost:8080/health`
- **Дані з БД (items):** `curl http://localhost:8080/items`
- **Сторінки (pages):** `curl http://localhost:8080/pages`

```bash
# 3. Зупинити всі контейнери
docker compose down
```

---

### Запуск окремого контейнера бекенду

```bash
# Збірка образу
docker build -t docuflow-api:1.0.0 ./backend

# Запуск
docker run --name docuflow-api --rm -d -p 8080:8080 docuflow-api:1.0.0

# Перевірка
curl http://localhost:8080/health

# Зупинка
docker stop docuflow-api
```
