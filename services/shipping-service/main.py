import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="shipping-service")

shipments: dict[str, dict] = {}

CARRIERS = ["AllegroExpress", "TempoFreight", "RagaLogistics"]
STAGES = ["LABEL_CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]


class ShipmentRequest(BaseModel):
    address: str
    items: list[dict]


class QuoteRequest(BaseModel):
    address: str
    itemCount: int = 1


@app.get("/healthz")
def health():
    return {"status": "ok", "service": "shipping-service"}


@app.post("/quotes")
def quote(req: QuoteRequest):
    base = 999
    return {
        "carrier": random.choice(CARRIERS),
        "costCents": base + req.itemCount * 250,
        "estimatedDays": random.randint(2, 7),
    }


@app.post("/shipments", status_code=201)
def create_shipment(req: ShipmentRequest):
    tracking = "SHP-" + "".join(random.choices(string.digits, k=5))
    eta = datetime.now(timezone.utc) + timedelta(days=random.randint(2, 7))
    shipments[tracking] = {
        "trackingId": tracking,
        "carrier": random.choice(CARRIERS),
        "address": req.address,
        "itemCount": len(req.items),
        "status": STAGES[0],
        "eta": eta.isoformat(),
    }
    return shipments[tracking]


@app.get("/tracking/{tracking_id}")
def track(tracking_id: str):
    shipment = shipments.get(tracking_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="unknown tracking id")
    # advance the shipment one stage per lookup, demo-style
    idx = STAGES.index(shipment["status"])
    if idx < len(STAGES) - 1:
        shipment["status"] = STAGES[idx + 1]
    return shipment
