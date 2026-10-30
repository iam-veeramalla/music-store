# Dash0 Operator — Setup Steps

Steps used to install and configure the Dash0 Kubernetes operator for the Music Store demo
(kind cluster `dash0-demo`, app namespace `music-shop`).

## Prerequisites

- Kubernetes cluster (1.25.16+) with the Music Store app deployed (`kubectl apply -f k8s/`)
- Helm 3
- A Dash0 account with:
  - **Ingress endpoint** (Settings → Endpoints), e.g. `ingress.us-east-1.aws.dash0.com:4317`
  - **Auth token** (Settings → Auth Tokens)

## 1. Install the operator

```bash
helm repo add dash0-operator https://dash0hq.github.io/dash0-operator
helm repo update

helm upgrade --install dash0-operator dash0-operator/dash0-operator \
  --namespace dash0-system --create-namespace \
  --set operator.dash0Export.enabled=true \
  --set operator.dash0Export.endpoint=<YOUR_INGRESS_ENDPOINT> \
  --set operator.dash0Export.token=<YOUR_AUTH_TOKEN> \
  --set operator.instrumentation.enablePythonAutoInstrumentation=true \
  --set operator.instrumentation.enableRubyAutoInstrumentation=true
```

Flag notes:
- `dash0Export.*` pre-configures the operator's OpenTelemetry collectors to ship
  traces, logs, and metrics straight to Dash0 with authentication.
- Java, Node.js, and .NET auto-instrumentation are **on by default**.
  Python and Ruby are **opt-in** — the two `enable*AutoInstrumentation` flags are
  required for `order-service`/`shipping-service` (Python) and `payment-service` (Ruby).

Verify:

```bash
kubectl -n dash0-system get pods
# expect: operator controller, cluster-metrics collector, collector agent daemonset — all Running
```

## 2. Enable monitoring for the app namespace

Instrumentation is namespace-scoped, activated by a `Dash0Monitoring` resource:

```bash
kubectl apply -f k8s/90-dash0-monitoring.yaml
```

Contents:

```yaml
apiVersion: operator.dash0.com/v1alpha1
kind: Dash0Monitoring
metadata:
  name: dash0-monitoring-resource
  namespace: music-shop
spec: {}
```

The operator then restarts every workload in `music-shop` and injects
zero-code instrumentation.

Verify:

```bash
kubectl -n music-shop get dash0monitoring dash0-monitoring-resource \
  -o jsonpath='{.status.conditions[*].type}={.status.conditions[*].status}'
# Available=True

kubectl -n music-shop get pods   # all pods restarted, Running
```

## 3. Verify instrumentation was injected

Inspect any app pod:

```bash
POD=$(kubectl -n music-shop get pod -l app.kubernetes.io/name=order-service -o name | head -1)
kubectl -n music-shop get $POD -o jsonpath='{.spec.initContainers[*].name} | {.spec.containers[0].env[?(@.name=="LD_PRELOAD")].value}'
```

Expected:
- init container `dash0-instrumentation` (copies OTel SDKs into a shared volume)
- `LD_PRELOAD=/__otel_auto_instrumentation/injector/libotelinject.so`
- `OTEL_EXPORTER_OTLP_ENDPOINT` pointing at the node-local collector

No OTel SDKs exist in any service's dependencies — the operator injects everything.

## 4. How the app was prepared for Dash0 (design decisions)

- **Runtimes chosen from the supported list**: Java 21, Node.js 20, .NET 8,
  Python 3.12, Ruby 3.3. Go was deliberately avoided (static binaries can't be
  hooked via `LD_PRELOAD`); frontend is served by Node/Express instead of nginx
  for the same reason.
- **Service naming via labels**: every Deployment and pod template carries
  `app.kubernetes.io/name`, `app.kubernetes.io/version`, and
  `app.kubernetes.io/part-of: music-store`, which the operator maps to
  `service.name`, `service.version`, and `service.namespace`.
- **Deployments only** (no bare Pods/Jobs) so the operator can restart workloads
  to apply instrumentation.
- **Interesting telemetry built in**: checkout produces one distributed trace
  across 5 runtimes plus Postgres and Redis; payment-service declines ~5% of
  charges (HTTP 402) for error traces; a load-generator keeps traffic flowing.

## 5. What to look at in Dash0

- **Tracing**: a single checkout trace: api-gateway (Node) → order-service (Python)
  → inventory-service (.NET) + payment-service (Ruby) + shipping-service (Python) + DB spans
- **Errors**: HTTP 402 payment declines, HTTP 409 stock conflicts
- **Logs**: pod logs from all services, correlated with traces
- **Metrics**: cluster/node/pod/container metrics for the namespace
- **Resource map**: all 8 services grouped under `music-store`

## Cleanup / security note

- Rotate the auth token after a demo if it was shared or typed in a terminal.
- To stop monitoring: `kubectl delete -f k8s/90-dash0-monitoring.yaml`
  (operator reverts workloads), then `helm uninstall dash0-operator -n dash0-system`.
