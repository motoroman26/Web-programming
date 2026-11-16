# Лабораторна робота №10: Kubernetes, практична частина (REPORT)

Рівні 60–90 виконуються в форку навчального репозиторію [`vivalafit/k8s-demo`](https://github.com/vivalafit/k8s-demo) за інструкцією практикуму. Тут описано **рівень 100**: міграцію власного проєкту DocuFlow у Kubernetes, а також відповіді на контрольні запитання.

---

## 1. Власний сервіс

DocuFlow — корпоративна база знань. Ендпоінти для перевірки: `GET /health` (liveness), `GET /ready` (readiness, перевіряє PostgreSQL), `GET /api/...` (API курсового проєкту). Репозиторій: https://github.com/ozzi0813/Web-programming

Маніфести — у папці [`k8s/`](../../k8s):

| Файл | Ресурси |
|---|---|
| `namespace.yaml` | Namespace `docuflow` |
| `configmap.yaml` | ConfigMap `docuflow-config` (APP_ENV, PGHOST, PGDATABASE...) |
| `secret.yaml` | Secret `docuflow-secret` (PGPASSWORD, JWT_SECRET) |
| `postgres.yaml` | StatefulSet + Service `docuflow-db` (PVC 1 Gi) |
| `api.yaml` | Deployment `docuflow-api` (2 репліки, initContainer `migrate`, liveness/readiness) + Service ClusterIP 80→8080 |
| `web.yaml` | ConfigMap з `config.js` + Deployment `docuflow-web` (2 репліки) + Service |
| `ingress.yaml` | Ingress: `docuflow.local` → web, `api.docuflow.local` → api |
| `kustomization.yaml` | застосування всього однією командою |

## 2. Команди

```bash
minikube start --memory=4096 --cpus=2 --driver=docker
minikube addons enable ingress

# Образи збираються всередині Minikube (registry не потрібен)
minikube image build -t docuflow-api:1.0.0 ./backend
minikube image build -t docuflow-web:1.0.0 ./web

kubectl apply -k k8s/
kubectl get deployment,statefulset,rs,pods,svc,ingress -n docuflow

# Доступ без Ingress
kubectl port-forward svc/docuflow-api -n docuflow 8082:80
curl http://localhost:8082/health
curl http://localhost:8082/ready

# Доступ через Ingress (Windows: C:\Windows\System32\drivers\etc\hosts)
#   127.0.0.1 docuflow.local api.docuflow.local
minikube tunnel
curl http://api.docuflow.local/ready
# браузер: http://docuflow.local  (вхід: owner@kolosok.demo / demo12345)
```

Зміна конфігурації через ConfigMap:
```bash
kubectl edit configmap docuflow-config -n docuflow          # наприклад, APP_ENV: k8s-prod
kubectl rollout restart deployment docuflow-api -n docuflow
kubectl exec -n docuflow deploy/docuflow-api -- env | grep APP_ENV
```

Самовідновлення:
```bash
kubectl delete pod -n docuflow -l app=docuflow-api --wait=false
kubectl get pods -n docuflow -w
```

Діагностика:
```bash
kubectl describe pod <pod> -n docuflow                 # події, probes, причина рестартів
kubectl logs <pod> -n docuflow -c migrate              # лог міграцій (initContainer)
kubectl logs deploy/docuflow-api -n docuflow           # JSON-логи запитів
kubectl get events -n docuflow --sort-by=.metadata.creationTimestamp
kubectl describe ingress docuflow-ingress -n docuflow
```

> **TODO (Макс):** вставити реальні виводи `kubectl get deployment,rs,pods,svc -n docuflow`, `curl .../ready` та скріншот застосунку за адресою `http://docuflow.local`.

## 3. Відмінності від k8s-demo

- **Три компоненти** замість одного: PostgreSQL як StatefulSet з PVC (дані не зникають при перезапуску пода).
- **Міграції БД в initContainer:** под API стартує лише після успішних міграцій. Дві репліки не мігрують одночасно завдяки `pg_advisory_lock`.
- **Різні liveness і readiness:** `/health` перевіряє лише процес, `/ready` — ще й з'єднання з БД. Якщо БД недоступна, поди лишаються живими, але Service не шле на них трафік.
- **Фронтенд конфігурується через ConfigMap,** змонтований як файл (`config.js` з адресою API), а не через змінні оточення.
- **Два хости в Ingress** і збільшений `proxy-body-size` для завантаження документів.

## 4. Контрольні запитання

**ConfigMap vs Secret.** Обидва зберігають ключ-значення для конфігурації. ConfigMap — для несекретних даних (назва БД, режим). Secret — для паролів і ключів: зберігається в base64, доступ обмежується RBAC, у кластері можна ввімкнути шифрування в etcd. У нас `PGPASSWORD` і `JWT_SECRET` — у Secret, решта — у ConfigMap.

**Liveness vs readiness.** Liveness відповідає на питання «чи живий процес». Якщо ні, kubelet перезапускає контейнер (`/health`). Readiness відповідає на питання «чи готовий под приймати трафік». Якщо ні, под прибирається з endpoints Service, але не перезапускається (`/ready`, перевіряє БД). Значення: liveness `initialDelaySeconds: 10, periodSeconds: 10, failureThreshold: 3`; readiness — `5, 5, 3`.

**Шлях запиту:**
- через `kubectl port-forward svc/docuflow-api 8082:80`: локальний порт → API-сервер Kubernetes → один под за Service (Ingress не задіяний);
- через `http://docuflow.local`: DNS/hosts → `minikube tunnel` → Ingress-контролер nginx → Service `docuflow-web` → под web. Запити фронтенду до `api.docuflow.local` йдуть через Ingress → Service `docuflow-api` → под api.

**Як оновлювати конфігурацію з ConfigMap через env.** Змінні оточення підставляються лише під час створення контейнера. Тому після `kubectl apply` ConfigMap потрібен `kubectl rollout restart deployment/...`: Deployment поступово замінить поди, і нові отримають нові значення. Альтернатива — монтувати ConfigMap як файл (як `config.js` у web): файл оновлюється в поді без рестарту, але застосунок має його перечитати.

**Як мігровано власний сервіс.** Додано `/ready`. Міграції винесено в initContainer з advisory lock. Секрети — у Secret. Додано StatefulSet для PostgreSQL. Фронтенд отримує адресу API з ConfigMap. Образи збираються в Minikube (`minikube image build`) або беруться з GHCR (лаба 7).
