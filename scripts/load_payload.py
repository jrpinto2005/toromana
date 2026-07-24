#!/usr/bin/env python3
"""
Fase 2 del importador: sube a Supabase el JSON que produjo parse_workbook.py.

    export NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=...
    python3 scripts/load_payload.py

Usa la llave de servicio, que se salta RLS. Corre solo en local y nunca desde el
navegador. Solo stdlib: este script se ejecuta una vez y no merece dependencias.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

CHUNK = 100

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def request(method: str, path: str, body=None, prefer: str | None = None):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer

    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}", data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        sys.exit(f"\n{method} {path} falló ({e.code}):\n{e.read().decode()}")


def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main() -> int:
    if not URL or not KEY:
        return print(
            "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY."
        ) or 1

    payload_path = Path("local/import-payload.json")
    if not payload_path.exists():
        return print(f"No existe {payload_path}. Corre antes parse_workbook.py.") or 1

    payload = json.loads(payload_path.read_text("utf-8"))
    customers = payload["customers"]
    cutoff = payload["cutoff_date"]

    existing = request("GET", "customers?select=id&limit=1")
    if existing:
        return print(
            "La tabla de clientes ya tiene datos. Vacíala antes de reimportar:\n"
            "  delete from customers;"
        ) or 1

    products = {p["name"]: p["id"] for p in request("GET", "products?select=id,name")}
    missing = {
        item["product"]
        for c in customers
        for item in c["standing_items"]
        if item["product"] not in products
    }
    if missing:
        return print(f"Productos que no existen en la base: {sorted(missing)}") or 1

    # Los clientes se insertan por lotes pidiendo las filas de vuelta. PostgREST
    # las devuelve en el mismo orden en que se enviaron, así que se emparejan por
    # posición y no por nombre: hay nombres repetidos y emparejar por texto
    # asignaría el pedido fijo al cliente equivocado.
    inserted = 0
    standing_rows = []

    for batch in chunked(customers, CHUNK):
        rows = [
            {
                "name": c["name"],
                "address": c["address"],
                "recurrence": c["recurrence"],
                "opening_balance_cop": c["opening_balance_cop"],
                "opening_balance_date": cutoff if c["opening_balance_cop"] else None,
            }
            for c in batch
        ]
        created = request(
            "POST", "customers", rows, prefer="return=representation"
        )
        if len(created) != len(batch):
            return print("La base devolvió menos filas de las enviadas.") or 1

        for source, row in zip(batch, created):
            for item in source["standing_items"]:
                standing_rows.append(
                    {
                        "customer_id": row["id"],
                        "product_id": products[item["product"]],
                        "quantity": item["quantity"],
                    }
                )
        inserted += len(created)
        print(f"  clientes: {inserted}/{len(customers)}")

    for batch in chunked(standing_rows, CHUNK):
        request("POST", "standing_order_items", batch, prefer="return=minimal")
    print(f"  pedidos fijos: {len(standing_rows)} líneas")

    with_balance = sum(1 for c in customers if c["opening_balance_cop"] > 0)
    total = sum(c["opening_balance_cop"] for c in customers)
    print(
        f"\nListo. {inserted} clientes, {len(standing_rows)} líneas de pedido fijo, "
        f"{with_balance} con saldo por ${total:,}".replace(",", ".")
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
