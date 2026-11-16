# DocuFlow — корпоративна база знань для бізнесу

[![CI](https://github.com/ozzi0813/Web-programming/actions/workflows/ci.yml/badge.svg)](https://github.com/ozzi0813/Web-programming/actions/workflows/ci.yml)

Курсовий проєкт з веб-програмування. Українська альтернатива Notion, заточена під компанії. Компанія реєструється й зберігає в одному місці статутні документи, регламенти, посадові інструкції, накази та оргструктуру. Доступ розмежовано за ролями.

**Можливості**
- 🏢 Реєстрація компанії, вхід (JWT + bcrypt), ролі **власник / адміністратор / редактор / глядач**.
- 🗂️ Дерево розділів і сторінок довільної вкладеності; переміщення, кошик з відновленням.
- ✍️ Блоковий редактор: заголовки, текст, списки, чекбокси, цитати, примітки, код, таблиці.
- 📎 Файли-документи до кожної сторінки (PDF, Word, Excel, зображення — до 10 МБ).
- 👔 Оргструктура: дерево відділів, посади зі штатом, працівники на посадах, посилання на посадові інструкції.
- 🔍 Пошук по назвах, тексту, таблицях і назвах файлів.
- 🛡️ Стійкість з лаби 5: ретраї, таймаути, `Idempotency-Key`, `X-Request-Id`, rate limiting.

**Стек:** HTML5 + CSS3 + JavaScript (без фреймворків) · Node.js 20 + Express 5 · PostgreSQL 15 · Docker · GitHub Actions · Kubernetes · OpenTelemetry.

**Команда:** Арсентій Кравчук — фронтенд · Роман Романюк — бекенд · Максим Озаринський — PostgreSQL, DevOps, документація (лідер).

| Документ | Посилання |
|---|---|
| Бізнес-документ, roadmap | [docs/business_doc.md](docs/business_doc.md), [docs/roadmap.md](docs/roadmap.md) |
| Домен (DDD) | [docs/domain/](docs/domain) |
| Діаграми | [docs/diagrams/](docs/diagrams) |
| API (OpenAPI) | [docs/api/openapi.yaml](docs/api/openapi.yaml) |
| ADR | [docs/adr/](docs/adr) |
| Звіти лаб 4–10 | [docs/labs/](docs/labs) |

---

## ⚡ Курсовий проєкт: швидкий старт

```bash
cd backend
cp .env.example .env          # вкажіть пароль PostgreSQL
npm install
npm run migrate -- --seed     # таблиці + демо-компанія «Пекарня Колосок»
npm start                     # API: http://localhost:8080
```
В іншому терміналі (з кореня репозиторію):
```bash
npx serve web -l 5500         # фронтенд: http://localhost:5500
```

**Демо-акаунти** (пароль `demo12345`):

| Email | Роль |
|---|---|
| `owner@kolosok.demo` | Власник |
| `hr@kolosok.demo` | Редактор |
| `staff@kolosok.demo` | Глядач |

Або одна команда: `docker compose up -d --build` → http://localhost:3000.

### Структура
```
backend/
  api/            маршрути Express (apiRouter.js — /api/..., pageRouter.js — лаби 4–5), middleware
  service/        бізнес-логіка: Auth, Member, Knowledge, Attachment, Org, Workspace
  domain/         сутності та правила: Member (RBAC), Block, Workspace, Attachment, OrgUnit
  repository/     SQL-запити до PostgreSQL (лише параметризовані)
  database/       migrations/*.sql, seeds/*.sql (запускає migrate.js)
  test/           node:test — юніт- та інтеграційні тести
web/
  index.html      вхід і реєстрація компанії
  app.html        застосунок (дерево, редактор, файли, оргструктура, працівники, пошук, кошик)
  labs.html       демо лабораторних 1–5
  js/, css/       модулі фронтенду та стилі
k8s/              маніфести Kubernetes (лаба 10)
observability/    дашборд Grafana (лаба 8)
.github/          CI/CD і Dependabot (лаба 7)
```

---

## 🏛 Архітектура (Практична робота №4)

У межах 4-ї практичної роботи було прийнято рішення продовжувати розвиток системи як **Модульного моноліту** з чіткою шаровою архітектурою:
- **API (`backend/api/`)**: маршрутизація Express, контролери, мапінг HTTP-запитів у DTO, валідація, формування HTTP-відповідей.
- **Service (`backend/service/`)**: бізнес-логіка, сценарії використання (Use Cases), валідація інваріантів, мапінг DTO <-> Domain.
- **Domain (`backend/domain/`)**: чисті доменні моделі (`Page`, `Block`, `User`) без зовнішніх залежностей.
- **Repository (`backend/repository/`)**: рівень доступу до даних (PostgreSQL з підтримкою in-memory fallback для локального тестування).

### Архітектурні рішення (ADR)
1. [ADR 0001: Вибір архітектурного стилю — Модульний моноліт](docs/adr/0001-architecture-style.md)
2. [ADR 0002: Шарова архітектура модульного моноліту (Layered Architecture)](docs/adr/0002-layered-architecture.md)
3. [ADR 0003: Стиль API, статус-коди та єдина модель помилок (Error Model)](docs/adr/0003-api-style-and-error-model.md)
4. [ADR 0004: Стратегії відмовостійкості, ідемпотентність, Rate Limiting та кореляція X-Request-Id](docs/adr/0004-resilience-and-error-handling.md)

---

## 🛡️ Стійкість та обробка помилок (Практична робота №5)

У системі реалізовано повноцінний набір механізмів відмовостійкості та кореляції:
- **Ідемпотентність (`Idempotency-Key`)**: запобігає дублюванню операцій створення сторінки `POST /pages`. Повторний запит із тим самим ключем повертає збережений результат (201 Created) без створення нового запису в базі даних. Підтримується також захист від паралельних сабмітів (double click).
- **Кореляція запитів (`X-Request-Id`)**: кожен запит отримує унікальний ідентифікатор, який повертається у заголовку відповіді та дублюється у полі `requestId` тіла будь-якої помилки.
- **Обмеження частоти запитів (Rate Limiting)**: захист від перевантаження (вікно 10с, ліміт 8 запитів). При перевищенні повертається статус `429 Too Many Requests` із заголовком `Retry-After: 2`.
- **Симуляція збоїв (Fault / Chaos Injection)**: можливість тестування клієнтських ретраїв та таймаутів (заголовки `X-Simulate-Delay`, `X-Simulate-Error: 500|503`, або змінна `ENABLE_CHAOS=true`).

### Приклади тестування через cURL

#### 1. Перевірка ідемпотентності створення сторінки:
```bash
# Перший виклик (створення сторінки):
curl -i -X POST http://localhost:8080/pages \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: notion-demo-key-1" \
  -H "X-Request-Id: client-trace-001" \
  -d '{"title": "Новий документ Notion", "icon": "📝"}'

# Повторний виклик із тим самим Idempotency-Key (повертає той самий id без дублювання):
curl -i -X POST http://localhost:8080/pages \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: notion-demo-key-1" \
  -H "X-Request-Id: client-trace-002" \
  -d '{"title": "Новий документ Notion", "icon": "📝"}'
```

#### 2. Перевірка Rate Limit (429 та Retry-After):
Виконайте серію швидких запитів (більше 8 запитів за 10 секунд):
```bash
curl -i http://localhost:8080/health
```
При перевищенні ліміту сервер поверне `429 Too Many Requests` із заголовком `Retry-After: 2` та JSON-відповіддю з `requestId`.

---

## 📖 API документація

Специфікація API спроектована за підходом Contract-First та формалізована за стандартом OpenAPI 3.0:
- Контракт API: [docs/api/openapi.yaml](docs/api/openapi.yaml)

### Скріншот документації у Swagger Editor
![API Документація Swagger](docs/api/swagger_screenshot.png)

### Реалізовані ендпоінти
| Метод | Шлях | Опис | Статуси відповідей |
|:---|:---|:---|:---|
| `GET` | `/health` | Системний health-check | `200 OK` (`{ "status": "ok" }`) |
| `POST` | `/pages` | Створення нової сторінки (підтримує `Idempotency-Key`) | `201 Created`, `400 Bad Request`, `429 Too Many Requests` |
| `GET` | `/pages` | Отримання списку сторінок (з фільтрацією) | `200 OK` |
| `GET` | `/pages/{id}` | Отримання сторінки за ID | `200 OK`, `400 Bad Request`, `404 Not Found` |
| `PUT` | `/pages/{id}` | Повне/часткове оновлення сторінки | `200 OK`, `400 Bad Request`, `404 Not Found` |
| `DELETE` | `/pages/{id}` | Видалення сторінки | `204 No Content`, `400 Bad Request`, `404 Not Found` |

### Єдиний формат помилки (`ErrorResponse`)
Усі помилки повертаються в стандартизованому JSON-форматі з обов'язковим `requestId`:
```json
{
  "error": "ValidationError",
  "code": "TITLE_REQUIRED",
  "details": [
    {
      "field": "title",
      "message": "Title is required and cannot be empty"
    }
  ],
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 🚀 Швидкий старт

### 1. Налаштування оточення
Перейдіть у папку `backend` та за потреби створіть/налаштуйте `.env`:
```bash
cd backend
cp .env.example .env
```

### 2. Запуск міграцій БД (PostgreSQL)
```bash
npm run migrate            # лише схема
npm run migrate -- --seed  # схема + демо-дані
```
Міграції лежать у `backend/database/migrations` і виконуються один раз кожна (облік у таблиці `schema_migrations`).

### 3. Запуск юніт- та інтеграційних тестів
Покриває доменний шар, сервісний рівень `PageService`, ендпоінти API, а також механізми відмовостійкості (ідемпотентність, rate-limiting, кореляція, таймаути):
```bash
npm test
```

### 4. Запуск сервера
```bash
npm start
# або в режимі розробки з автоперезапуском:
npm run dev
```
Сервер буде доступний за адресою `http://localhost:8080`.

### 5. Запуск фронтенду (`web/`)
Фронтенд — чистий HTML + CSS + JavaScript, збирати нічого не потрібно. Бекенд має працювати на `http://localhost:8080`.
```bash
npx serve web -l 5500
```
Відкрийте `http://localhost:5500` — сторінка входу в застосунок. Демо лабораторних 1–5 — `http://localhost:5500/labs.html`.

Що є на сторінці лаб (`labs.html`):
- **Сторінки (Практична 4)** — створення, список, перейменування (`PUT`) та видалення (`DELETE`) сторінок через `/pages`.
- **Стійкість (Практична 5)** — файл `web/http.js`: таймаут через `AbortController`, ретраї на 5xx і мережеві збої з експоненційним backoff та джитером, очікування за `Retry-After` при 429, `X-Request-Id` у кожному запиті, `Idempotency-Key` для `POST /pages`.
- **Degraded mode** — після 3 збоїв поспіль з'являється банер «Сервер перевантажений», кнопки блокуються на 10 секунд.
- **Перевірка** — кнопки «Повільний /health» (таймаут 1 с), «Запит з помилкою 503», «Тест подвійного кліку» та прапорець випадкових збоїв; усі спроби видно в «Журналі запитів».
- **Практична 1** — кнопка «Load items» (`GET /items`).

---

## 🐳 Контейнеризація та запуск у Docker (Практична робота №6)

Проєкт підтримує запуск як окремих сервісів у Docker-контейнерах, так і повну оркестрацію всього стеку (`web` + `api` + `db`) через **Docker Compose**.

Детальний звіт про виконання: [docs/labs/lab_06.md](docs/labs/lab_06.md).

### 1. Перевірка роботи Docker
```bash
docker version
docker run hello-world
```

### 2. Запуск окремого контейнера API
```bash
# Збірка образу бекенду
docker build -t docuflow-api:1.0.0 ./backend

# Запуск контейнера
docker run --name docuflow-api --rm -d -p 8080:8080 docuflow-api:1.0.0

# Перевірка працездатності
curl http://localhost:8080/health

# Зупинка контейнера
docker stop docuflow-api
```

### 3. Повний запуск системи через Docker Compose (90–100 балів)
Однією командою піднімаються 3 сервіси:
- `web` — фронтенд на Nginx (`http://localhost:3000`)
- `api` — бекенд на Node.js (`http://localhost:8080`)
- `db` — база даних PostgreSQL 15 (`localhost:5432`); схему й демо-дані створює контейнер `api` командою `node migrate.js --seed` перед стартом

```bash
# Запуск усіх сервісів у фоновому режимі зі збіркою образів:
docker compose up -d --build

# Перевірка статусу контейнерів:
docker compose ps

# Перегляд логів:
docker compose logs -f

# Перевірка роботи API:
curl http://localhost:8080/health
curl http://localhost:8080/items
curl http://localhost:8080/pages

# Відкрийте фронтенд у браузері:
http://localhost:3000

# Зупинка всіх сервісів та звільнення ресурсів:
docker compose down
```

---

## 🔁 CI/CD (Практична робота №7)

[`.github/workflows/ci.yml`](.github/workflows/ci.yml):
- **test** — тести бекенду з PostgreSQL у CI, JUnit і LCOV як артефакти, підсумок у Job Summary;
- **lint** — перевірка JS фронтенду;
- **docker** — образи `api` і `web` → GHCR (`ghcr.io/ozzi0813/docuflow-api`, `ghcr.io/ozzi0813/docuflow-web`), теги `sha-<commit>`, `vX.Y.Z`, `latest`;
- **release** — GitHub Release з авто-нотатками на тег `v*`.

**Delivery:** GHCR (варіант A). Реліз: `git tag v1.0.0 && git push origin v1.0.0`.

**Style points:** семантичне тегування; мінімальні permissions і concurrency з cancel-in-progress; Job Summary; Dependabot; Trivy scan (exit-code 0); автоматичні реліз-нотатки. Детально — [docs/labs/lab_07.md](docs/labs/lab_07.md).

## 📈 Observability (Практична робота №8)

```bash
# бекенд з OpenTelemetry (трейси + метрики → OTLP-колектор стенду observability-demo)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npm run start:otel
```
Дашборд Grafana: [observability/docuflow-red-dashboard.json](observability/docuflow-red-dashboard.json). Алерти та звіт — [docs/labs/lab_08.md](docs/labs/lab_08.md).

## ☸️ Kubernetes (Практичні роботи №9–10)

```bash
minikube start --driver=docker && minikube addons enable ingress
minikube image build -t docuflow-api:1.0.0 ./backend
minikube image build -t docuflow-web:1.0.0 ./web
kubectl apply -k k8s/
kubectl get pods,svc,ingress -n docuflow
```
Схема — [docs/labs/lab_09.md](docs/labs/lab_09.md), практична частина і контрольні запитання — [docs/labs/lab_10.md](docs/labs/lab_10.md).
