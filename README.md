# Music Store

## Introduction

A demo application with a multi microservice architecture that Abhishek created to demonstrate observability implementation using the Dash0 Kubernetes operator.

It is an online store that sells musical instruments. The app is made of 8 microservices written in 5 different languages (Java, Node.js, .NET, Python and Ruby), plus a load generator that acts like real shoppers.

| Service            | Language    | What it does                        |
|--------------------|-------------|-------------------------------------|
| frontend           | Node.js     | The store website                   |
| api-gateway        | Node.js     | Routes browser calls to services    |
| catalog-service    | Java        | Products and categories (Postgres)  |
| inventory-service  | .NET        | Stock levels and reservations       |
| cart-service       | Node.js     | Shopping cart (Redis)               |
| order-service      | Python      | Checkout and orders (Postgres)      |
| payment-service    | Ruby        | Mock payments                       |
| shipping-service   | Python      | Shipments and tracking              |

## Architecture

The basic user flow looks like this:

```
                                              +-> catalog-service ---> Postgres
                                              |
 User ---> frontend ---> api-gateway ---------+-> inventory-service
(browser)                                     |
                                              +-> cart-service ------> Redis
                                              |
                                              +-> order-service -----> Postgres
                                                     |
                                                     +-> payment-service
                                                     +-> inventory-service
                                                     +-> shipping-service
```

A user browses products, adds them to the cart and checks out. During checkout the order service reserves stock, charges the payment and creates a shipment.

## Folder structure

```
music-shop-app/
├── services/
│   ├── frontend/           # store website (Node.js)
│   ├── api-gateway/        # API gateway (Node.js)
│   ├── catalog-service/    # products (Java, Spring Boot)
│   ├── inventory-service/  # stock (.NET)
│   ├── cart-service/       # cart (Node.js + Redis)
│   ├── order-service/      # checkout (Python, FastAPI)
│   ├── payment-service/    # payments (Ruby, Sinatra)
│   ├── shipping-service/   # shipping (Python, FastAPI)
│   └── load-generator/     # fake shoppers for live traffic
├── k8s/                    # Kubernetes manifests
├── docker-compose.yml      # run everything locally
├── build-images.sh         # build all Docker images
├── dash0-setup.md          # Dash0 observability setup guide
└── README.md
```

## How to run locally

You need Docker installed. Then run:

```bash
docker compose up --build
```

Open the store at http://localhost:8080

## How to run in Kubernetes

Build the images and load them into your cluster (example for kind):

```bash
./build-images.sh --kind      # use --minikube for minikube
```

Deploy everything:

```bash
kubectl apply -f k8s/
```

Open the store:

```bash
kubectl -n music-shop port-forward svc/frontend 8080:8080
```

Then visit http://localhost:8080

## Observability with Dash0

This app is built to show how the Dash0 Kubernetes operator adds traces, logs and metrics to all services automatically, with zero code changes.

Follow the step by step guide in [dash0-setup.md](dash0-setup.md).

## Contributions

Contributions are welcome. Feel free to open an issue or send a pull request.

## License

This project is open source under the [MIT License](LICENSE). Free to use, copy and modify.
