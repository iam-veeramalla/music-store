#!/usr/bin/env bash
# Build all Music Store images. Usage: ./build-images.sh [--kind | --minikube]
set -euo pipefail
cd "$(dirname "$0")"

SERVICES=(frontend api-gateway catalog-service inventory-service cart-service order-service payment-service shipping-service load-generator)

for svc in "${SERVICES[@]}"; do
  echo "==> building musicshop/$svc:1.0.0"
  docker build -t "musicshop/$svc:1.0.0" "services/$svc"
done

if [[ "${1:-}" == "--kind" ]]; then
  for svc in "${SERVICES[@]}"; do kind load docker-image "musicshop/$svc:1.0.0"; done
elif [[ "${1:-}" == "--minikube" ]]; then
  for svc in "${SERVICES[@]}"; do minikube image load "musicshop/$svc:1.0.0"; done
fi
echo "done."
