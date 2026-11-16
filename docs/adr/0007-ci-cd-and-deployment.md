# ADR 0007: CI/CD у GitHub Actions, образи в GHCR, розгортання в Kubernetes

**Статус:** Прийнято
**Дата:** 2026-11-15

## Контекст

У проєкті два збірні сервіси (`api`, `web`) і PostgreSQL. Потрібні:
- автоматична перевірка кожного pull request;
- відтворювана збірка образів;
- зрозумілий шлях від коміту до працюючого пода.

## Рішення

1. **CI** (`.github/workflows/ci.yml`) запускається на кожен PR і push у `main`:
   - `test` — тести бекенду з сервісом PostgreSQL 15 (міграції → юніт- та інтеграційні тести), звіти JUnit і LCOV як артефакти, підсумок у Job Summary;
   - `lint` — перевірка синтаксису JS фронтенду.
2. **Delivery**: job `docker` збирає образи `api` і `web` (matrix). На `main` і тегах `v*.*.*` публікує їх у `ghcr.io/<owner>/docuflow-<service>`. Теги: `sha-<commit>`, `vX.Y.Z`, `X.Y`, `latest`. У PR образи лише збираються.
3. **Style points:**
   - семантичне тегування `vX.Y.Z` + `sha-<commit>`;
   - мінімальні `permissions` + `concurrency` з `cancel-in-progress`;
   - Job Summary з кількістю тестів і покриттям;
   - Dependabot для npm, GitHub Actions і Docker;
   - Trivy scan з `exit-code: 0`;
   - автоматичні реліз-ноти на тег `v*`.
4. **Розгортання** (`k8s/`): Namespace `docuflow`, ConfigMap, Secret, StatefulSet PostgreSQL з PVC, Deployment `docuflow-api` (2 репліки, initContainer з міграціями, liveness `/health`, readiness `/ready`), Deployment `docuflow-web` (2 репліки, `config.js` з ConfigMap), Services типу ClusterIP та Ingress (`docuflow.local`, `api.docuflow.local`).

## Наслідки

- Злиття в `main` можна захистити правилом «Required status checks: test, lint» (Branch protection).
- Міграції безпечні для кількох реплік завдяки `pg_advisory_lock` у `migrate.js`.
- Зміна ConfigMap потребує `kubectl rollout restart`, бо змінні оточення читаються під час старту контейнера.
