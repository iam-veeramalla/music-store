import os
import random
import string
from datetime import datetime, timezone

import httpx
import psycopg
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://musicshop:musicshop@localhost:5432/musicshop")
PAYMENT_URL = os.getenv("PAYMENT_SERVICE_URL", "http://localhost:8085")
INVENTORY_URL = os.getenv("INVENTORY_SERVICE_URL", "http://localhost:8082")
SHIPPING_URL = os.getenv("SHIPPING_SERVICE_URL", "http://localhost:8086")

app = FastAPI(title="order-service")


class OrderItem(BaseModel):
    productId: int
    name: str
    priceCents: int
    quantity: int = 1


class OrderRequest(BaseModel):
    sessionId: str
    customerName: str
    email: str
    address: str
    items: list[OrderItem]


def db():
    return psycopg.connect(DATABASE_URL)


@app.on_event("startup")
def init_schema():
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              customer_name TEXT NOT NULL,
              email TEXT NOT NULL,
              address TEXT NOT NULL,
              total_cents BIGINT NOT NULL,
              transaction_id TEXT,
              tracking_id TEXT,
              status TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL
            )
            """
        )


def order_id() -> str:
    suffix = "".join(random.choices(string.digits, k=4))
    return f"ORD-{datetime.now(timezone.utc):%Y%m%d}-{suffix}"


@app.get("/healthz")
def health():
    return {"status": "ok", "service": "order-service"}


@app.post("/orders", status_code=201)
def create_order(req: OrderRequest):
    if not req.items:
        raise HTTPException(status_code=400, detail="cart is empty")
    total = sum(i.priceCents * i.quantity for i in req.items)

    with httpx.Client(timeout=10) as client:
        # 1. reserve stock
        for item in req.items:
            r = client.post(f"{INVENTORY_URL}/reserve",
                            json={"productId": item.productId, "quantity": item.quantity})
            if r.status_code != 200:
                raise HTTPException(status_code=409,
                                    detail=f"stock reservation failed for {item.name}")

        # 2. charge payment; release reserved stock if the card is declined
        r = client.post(f"{PAYMENT_URL}/charge",
                        json={"amountCents": total, "currency": "USD"})
        if r.status_code != 200:
            for item in req.items:
                client.post(f"{INVENTORY_URL}/restock",
                            json={"productId": item.productId, "quantity": item.quantity})
            raise HTTPException(status_code=402, detail="payment declined")
        txn = r.json()["transactionId"]

        # 3. create shipment
        r = client.post(f"{SHIPPING_URL}/shipments",
                        json={"address": req.address,
                              "items": [i.model_dump() for i in req.items]})
        r.raise_for_status()
        tracking = r.json()["trackingId"]

    oid = order_id()
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """INSERT INTO orders
               (id, customer_name, email, address, total_cents, transaction_id,
                tracking_id, status, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (oid, req.customerName, req.email, req.address, total, txn,
             tracking, "CONFIRMED", datetime.now(timezone.utc)),
        )

    return {"orderId": oid, "status": "CONFIRMED", "totalCents": total,
            "transactionId": txn, "trackingId": tracking}


@app.get("/orders/{oid}")
def get_order(oid: str):
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM orders WHERE id = %s", (oid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="order not found")
        cols = [d.name for d in cur.description]
        return dict(zip(cols, [str(v) for v in row]))


@app.get("/orders")
def list_orders(email: str | None = None):
    with db() as conn, conn.cursor() as cur:
        if email:
            cur.execute("SELECT * FROM orders WHERE email = %s ORDER BY created_at DESC", (email,))
        else:
            cur.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50")
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, [str(v) for v in r])) for r in cur.fetchall()]
