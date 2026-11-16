# Лабораторна робота №10 — Kubernetes на практиці (рівні 60–90)

Команда DocuFlow, ІПЗ-32: Кравчук Арсентій, Романюк Роман, Озаринський Максим.
Середовище: Windows 11, Docker Desktop, Minikube v1.39.0 (Kubernetes v1.37.0, драйвер docker), kubectl v1.36.

Рівень 100 (перенесення власного сервісу DocuFlow) описано в основному репозиторії:
https://github.com/ozzi0813/Web-programming/blob/main/docs/labs/lab_10.md

---

## Рівень 60 — Minikube, Deployment, Service, port-forward

```bash
minikube start --memory=4096 --cpus=2 --driver=docker
minikube image build -t maxnavrotsky/k8s-demo-app:1.0.0 .
kubectl apply -f k8s/namespace.yaml -f k8s/configmap.yaml -f k8s/secret.yaml -f k8s/deployment.yaml -f k8s/service.yaml
kubectl get deployment,rs,pods,svc -n k8s-demo
```
```text
NAME                           READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/k8s-demo-api   2/2     2            2           7s

NAME                                      DESIRED   CURRENT   READY   AGE
replicaset.apps/k8s-demo-api-5c45559886   2         2         2       7s

NAME                                READY   STATUS    RESTARTS   AGE
pod/k8s-demo-api-5c45559886-8t47n   1/1     Running   0          7s
pod/k8s-demo-api-5c45559886-mxh5t   1/1     Running   0          7s

NAME                   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
service/k8s-demo-api   ClusterIP   10.99.202.57   <none>        80/TCP    7s
```
```bash
kubectl port-forward svc/k8s-demo-api -n k8s-demo 8090:80
curl http://localhost:8090/api/status
curl "http://localhost:8090/api/items?filter=a"
```
```text
{"status":"ok","appMode":"prod","version":"1.0.0","timestamp":"2026-11-16T11:44:01.642Z"}
[{"id":1,"name":"Item A"}]
```
**Шлях запиту:** curl → localhost:8090 → kubectl (тунель через API-сервер Kubernetes) → Service `k8s-demo-api` → один із подів (порт 8080). Ingress тут не задіяний.

## Рівень 75 — ConfigMap, Secret, probes, describe/logs

У `k8s/configmap.yaml` змінено `APP_MODE: "prod"` → `"staging"`:
```bash
kubectl apply -f k8s/configmap.yaml
curl http://localhost:8090/api/status      # → "appMode":"prod"  (ще старе значення)
kubectl rollout restart deployment k8s-demo-api -n k8s-demo
curl http://localhost:8090/api/status      # → "appMode":"staging"
```
**Чому без рестарту нічого не змінилось:** змінні оточення з ConfigMap підставляються лише під час створення контейнера. `rollout restart` по черзі замінює поди новими, і вони вже читають оновлений ConfigMap. Поки нові поди не пройшли readiness, трафік іде на старі, тому простою немає.

```bash
kubectl describe pod <pod> -n k8s-demo
```
```text
Liveness:   http-get http://:8080/healthz delay=5s timeout=1s period=10s #success=1 #failure=3
Readiness:  http-get http://:8080/ready delay=3s timeout=1s period=5s #success=1 #failure=3
Events:
  Normal  Scheduled  default-scheduler  Successfully assigned k8s-demo/k8s-demo-api-... to minikube
  Normal  Pulled     kubelet            Container image "maxnavrotsky/k8s-demo-app:1.0.0" already present on machine
  Normal  Created    kubelet            Container created
  Normal  Started    kubelet            Container started
```
```bash
kubectl logs deployment/k8s-demo-api -n k8s-demo --tail=5
```
```text
[2026-11-16T11:45:02.477Z] GET /healthz 200 0ms
[2026-11-16T11:45:03.087Z] GET /ready 200 0ms
[2026-11-16T11:45:08.087Z] GET /ready 200 1ms
```
- **Liveness** (`/healthz`): чи живий процес. Якщо 3 перевірки поспіль невдалі, kubelet перезапускає контейнер.
- **Readiness** (`/ready`): чи готовий под приймати трафік. Перші `READINESS_DELAY_MS=5000` мс відповідає 503, і поки так, Service не надсилає на под запити (у `get pods` видно `0/1 Running`).
- **Secret** `k8s-demo-secret` передає `SECRET_TOKEN` у base64 через `envFrom.secretRef`, окремо від звичайних налаштувань.

## Рівень 90 — Ingress, debug, самовідновлення

```bash
minikube addons enable ingress
kubectl apply -f k8s/ingress.yaml
kubectl get ingress -n k8s-demo
```
```text
NAME               CLASS   HOSTS            ADDRESS   PORTS   AGE
k8s-demo-ingress   nginx   k8s-demo.local             80      20s
```
У `C:\Windows\System32\drivers\etc\hosts` додано рядок `127.0.0.1 k8s-demo.local`, в окремому терміналі запущено `minikube tunnel`:
```bash
curl http://k8s-demo.local/api/status
```
```text
{"status":"ok","appMode":"staging","version":"1.0.0","timestamp":"2026-11-16T11:45:00.057Z"}
```
**Шлях запиту:** браузер/curl → hosts (`k8s-demo.local` = 127.0.0.1) → `minikube tunnel` → Ingress-контролер nginx → правило `host: k8s-demo.local` → Service `k8s-demo-api:80` → Pod `:8080`.

**Самовідновлення:**
```bash
kubectl delete pod k8s-demo-api-dfbdc666f-7k8qx -n k8s-demo --wait=false
kubectl get pods -n k8s-demo -o wide
```
```text
NAME                           READY   STATUS        RESTARTS   AGE   IP            NODE
k8s-demo-api-dfbdc666f-7k8qx   1/1     Terminating   0          76s   10.244.0.8    minikube
k8s-demo-api-dfbdc666f-fvz4n   1/1     Running       0          70s   10.244.0.9    minikube
k8s-demo-api-dfbdc666f-w7kq5   1/1     Running       0          13s   10.244.0.10   minikube
```
ReplicaSet побачив, що реплік стало менше за `replicas: 2`, і одразу створив новий под (`w7kq5`) з новою IP-адресою. Service продовжує працювати, бо шукає поди за лейблом `app=k8s-demo-api`, а не за IP.

**Debug flow** (що дивитись, якщо щось не працює):
| Симптом | Команда | Що шукати |
|---|---|---|
| Под не стартує | `kubectl describe pod <pod> -n k8s-demo` | Events: `ImagePullBackOff`, `CrashLoopBackOff`, невдалі probes |
| Помилки в застосунку | `kubectl logs pod/<pod> -n k8s-demo` | стек помилки, `SECRET_TOKEN` warning |
| Service не відповідає | `kubectl get endpoints k8s-demo-api -n k8s-demo` | чи є IP подів (якщо ні — readiness не пройшов або не збігся selector) |
| Ingress 404/502 | `kubectl describe ingress k8s-demo-ingress -n k8s-demo`, `kubectl logs -n ingress-nginx deploy/ingress-nginx-controller` | host, backend service, помилки контролера |
| Загальна картина | `kubectl get events -n k8s-demo --sort-by=.metadata.creationTimestamp` | що відбувалось у namespace |
