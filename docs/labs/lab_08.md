# Лабораторна робота №8: Observability (Grafana, Loki, Tempo, OpenTelemetry)

**Мета:** підключити бекенд DocuFlow до стенду observability-demo, побудувати RED-дашборд і налаштувати алерти.

Цільовий рівень: **95–100 балів**.

---

## 1. Що зроблено в коді

| Файл | Що робить |
|---|---|
| [`backend/tracing.js`](../../backend/tracing.js) | OpenTelemetry SDK: трейси та метрики HTTP, Express і `pg` → OTLP HTTP (`/v1/traces`, `/v1/metrics`). Вмикається лише якщо задано `OTEL_EXPORTER_OTLP_ENDPOINT`. |
| [`backend/api/middleware/requestLogger.js`](../../backend/api/middleware/requestLogger.js) | JSON-лог кожного запиту: `level`, `route`, `status`, `durationMs`, `requestId`, `traceId`, `userId`, `workspaceId`. Пише в stdout і у файл `LOG_FILE` (його читає Loki). |
| [`backend/api/middleware/auth.js`](../../backend/api/middleware/auth.js) | Додає до активного спану атрибути `enduser.id`, `enduser.role`, `docuflow.workspace_id`. |
| [`observability/docuflow-red-dashboard.json`](../../observability/docuflow-red-dashboard.json) | Дашборд Grafana «DocuFlow API — RED» (6 панелей). |

**Бібліотеки:** `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/exporter-metrics-otlp-http`.

**Атрибути:**
- `service.name=docuflow-api`, `service.version`, `deployment.environment` — ресурс;
- `http.route`, `http.request.method`, `http.response.status_code` — автоматично;
- `enduser.id`, `enduser.role`, `docuflow.workspace_id` — наші.

## 2. Запуск (покроково)

```bash
# 1. Стенд викладача
git clone https://github.com/vivalafit/observability-demo
cd observability-demo
docker compose up -d --build
docker compose stop loadgen          # вимикаємо тестове навантаження

# 2. Наш бекенд з телеметрією (у другому терміналі, папка backend)
#    PowerShell:
$env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
$env:LOG_FILE="<шлях-до>/observability-demo/data/logs/docuflow-api.log"
npm run start:otel

# 3. Трафік: відкрити фронтенд і поклацати сторінки, або:
#    кілька разів «Запит з помилкою 503» на labs.html — для помилок 5xx
```

> ⚠️ Імена метрик залежать від колектора. Перевірте в Grafana → Explore → Prometheus, як називається метрика (очікувано `http_server_request_duration_seconds_count`) і лейбл сервісу (`service_name` або `job`). За потреби замініть їх у JSON дашборду.

## 3. RED-дашборд (75 балів)

Імпорт: Grafana → Dashboards → New → Import → завантажити `observability/docuflow-red-dashboard.json` → вибрати Prometheus і Loki.

| Панель | Запит |
|---|---|
| Rate | `sum(rate(http_server_request_duration_seconds_count{service_name="docuflow-api"}[5m]))` |
| Errors, % | `100 * sum(rate(..._count{service_name="docuflow-api", http_response_status_code=~"5.."}[5m])) / sum(rate(..._count{service_name="docuflow-api"}[5m]))` |
| Duration p95 | `histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{service_name="docuflow-api"}[5m])))` |
| За маршрутами | `sum by (http_route) (rate(..._count{service_name="docuflow-api"}[5m]))` |
| Логи warn/error | `{job=~".+"} \|= "\"service\":\"docuflow-api\"" \| json \| level=~"warn\|error"` (LogQL) |
| Alert list | алерти з назвою, що містить «DocuFlow» |

Усі панелі використовують `$__rate_interval` і час дашборду, тож зміна періоду впливає на всі.

**Як цим користуватись у проді:** Rate показує навантаження. Errors — частку збоїв, саме вона сигналізує, що користувачі не можуть працювати. p95 показує, як довго чекають «майже всі» користувачі. Панель «За маршрутами» показує, який ендпоінт гальмує.

## 4. Трейси (90 балів)

У Grafana → Explore → Tempo → Search → Service Name = `docuflow-api`. Типовий трейс `GET /api/pages/:id` містить спани Express middleware, авторизації (`SELECT ... workspace_members`) та SQL-запитів сторінки, блоків, файлів і шляху.

**Приклади використання атрибутів:**
- знайти всі повільні запити однієї компанії: TraceQL `{ span.docuflow.workspace_id = 1 && duration > 200ms }`;
- перейти з рядка логу в Loki до трейсу за полем `traceId`.

## 5. Алерти (95–100 балів)

Grafana → Alerting → Alert rules → New alert rule (папка `DocuFlow`):

| Назва | Умова | Вікно | Що робити команді |
|---|---|---|---|
| **DocuFlow — частка 5xx > 5%** | `100 * sum(rate(..._count{service_name="docuflow-api",http_response_status_code=~"5.."}[5m])) / sum(rate(..._count{service_name="docuflow-api"}[5m])) > 5` | 5 хв | Перевірити `/ready` і логи `level=error`, доступність PostgreSQL, останній деплой (відкотити `kubectl rollout undo`). |
| **DocuFlow — p95 > 500 мс** | `histogram_quantile(0.95, sum by (le) (rate(..._bucket{service_name="docuflow-api"}[5m]))) > 0.5` | 5 хв | Знайти в Tempo найповільніші спани (зазвичай SQL), перевірити індекси та навантаження на БД, за потреби збільшити репліки. |

Contact point: `webhook` (наприклад, `https://webhook.site/...`) або Email з тестовою адресою. Notification policy: усі алерти з лейблом `team=docuflow` → цей contact point.

Як спровокувати: кілька разів поспіль натиснути «Запит з помилкою 503» на `labs.html` або запустити
```bash
for i in $(seq 1 50); do curl -s -H "X-Simulate-Error: 503" http://localhost:8080/health > /dev/null; done
```

## 6. Що потрібно додати у звіт

> **TODO (Макс):** скріншоти з реального стенду → `docs/labs/img/`:
> 1. RED-дашборд DocuFlow з даними;
> 2. відкритий трейс `docuflow-api` у Tempo;
> 3. логи `docuflow-api` у Loki;
> 4. налаштування алерту (запит і поріг);
> 5. сторінка Alerting зі статусом Firing;
> 6. панель Alert list на дашборді.
