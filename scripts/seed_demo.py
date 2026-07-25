#!/usr/bin/env python3
"""
Siembra datos de demostración sobre la base real de clientes.

    python3 scripts/seed_demo.py            # sembrar
    python3 scripts/seed_demo.py --clear    # borrar SOLO lo sembrado

Todo lo que crea queda anotado en local/demo-seed.json, así que la limpieza es
exacta: no borra por fecha ni por heurística, borra por id. Los 156 clientes
reales no se tocan nunca.

Lo que arma:
  · varias semanas de pedidos ya confirmados, con sus entregas
  · pagos con la mezcla que se ve en la vida real — la mayoría al día, algunos
    abonos parciales y unos pocos morosos de varios meses
  · cuatro lotes de gallinas en distintos momentos de su ciclo, con su historia
    semanal de producción siguiendo la curva de postura
  · notas del foro atadas a semanas y clientes
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from lay_curve import weekly_eggs  # noqa: E402

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
    "SUPABASE_SECRET_KEY", ""
)
LEDGER = Path("local/demo-seed.json")

random.seed(20260724)  # siembra reproducible: dos corridas dan lo mismo


def call(method: str, path: str, body=None, prefer: str | None = None):
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
        sys.exit(f"\n{method} {path} → {e.code}\n{e.read().decode()}")


def mondays_back(count: int) -> list[date]:
    """Los últimos `count` lunes, del más viejo al más reciente."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    return [monday - timedelta(weeks=i) for i in range(count - 1, -1, -1)]


# ─────────────────────────────────────────────────────────────
# Siembra
# ─────────────────────────────────────────────────────────────


def seed() -> None:
    if LEDGER.exists():
        sys.exit(
            f"Ya hay datos de demo sembrados ({LEDGER}).\n"
            "Corre primero:  python3 scripts/seed_demo.py --clear"
        )

    created: dict[str, list[str]] = {
        "delivery_runs": [],
        "payments": [],
        "hen_lots": [],
        "forum_posts": [],
    }

    def save() -> None:
        """
        El registro se escribe sobre la marcha, no al final.

        Si la siembra se cae a mitad de camino, `--clear` todavía sabe qué
        borrar; guardarlo solo al terminar dejaría huérfanos invisibles.
        """
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        LEDGER.write_text(json.dumps(created, indent=2), "utf-8")

    profiles = call("GET", "profiles?select=id,full_name,role,is_seller")
    sellers = [p for p in profiles if p["is_seller"]]
    admin = next((p for p in profiles if p["role"] == "admin"), profiles[0])
    if not sellers:
        sys.exit("No hay vendedores en profiles. Corre antes seed_users.py")

    products = {p["name"]: p for p in call("GET", "products?select=id,name,list_price_cop")}

    fijos = call(
        "GET",
        "customers?select=id,name,seller_id,recurrence,kind"
        "&recurrence=eq.semanal&active=eq.true&order=name",
    )
    ocasionales = call(
        "GET",
        "customers?select=id,name,seller_id&recurrence=eq.ocasional&active=eq.true&limit=40",
    )
    standing = call("GET", "standing_order_items?select=customer_id,product_id,quantity")

    by_customer: dict[str, list[dict]] = {}
    for row in standing:
        by_customer.setdefault(row["customer_id"], []).append(row)

    price = {p["id"]: p["list_price_cop"] for p in products.values()}

    # ── Semanas de pedidos ────────────────────────────────────
    weeks = mondays_back(6)
    print(f"Sembrando {len(weeks)} semanas de pedidos…")

    charges: dict[str, list[tuple[date, int]]] = {}

    for index, week in enumerate(weeks):
        is_current = index == len(weeks) - 1
        run = call(
            "POST",
            "delivery_runs",
            [
                {
                    "delivery_date": week.isoformat(),
                    "status": "borrador" if is_current else "confirmado",
                    "created_by": admin["id"],
                    "confirmed_at": None if is_current else f"{week}T12:00:00Z",
                }
            ],
            prefer="return=representation",
        )[0]
        created["delivery_runs"].append(run["id"])
        save()

        # Una semana normal: casi todos los fijos, un par que no va, y algún
        # ocasional que pidió. Es exactamente la variación que hoy se resuelve
        # revisando WhatsApps.
        going = [c for c in fijos if random.random() > 0.06]
        extras = random.sample(ocasionales, k=random.randint(1, 3)) if ocasionales else []

        # PostgREST exige las mismas llaves en todas las filas de un lote,
        # así que `added_by` viaja siempre, en null para las automáticas.
        def order_row(c, source: str):
            return {
                "run_id": run["id"],
                "customer_id": c["id"],
                "seller_id": c["seller_id"] or random.choice(sellers)["id"],
                "status": "pendiente" if is_current else "entregado",
                "source": source,
                "added_by": random.choice(sellers)["id"] if source == "manual" else None,
            }

        seen = {c["id"] for c in going}
        order_rows = [order_row(c, "auto") for c in going] + [
            order_row(c, "manual") for c in extras if c["id"] not in seen
        ]

        orders = call("POST", "orders", order_rows, prefer="return=representation")

        items = []
        totals: dict[str, int] = {}
        for order in orders:
            lines = by_customer.get(order["customer_id"], [])
            if not lines:
                # Un ocasional sin pedido habitual: pidió una cubeta.
                lines = [{"product_id": products["Cubeta"]["id"], "quantity": 1}]

            total = 0
            for line in lines:
                quantity = float(line["quantity"])
                # De vez en cuando alguien pide más o menos de lo habitual.
                if random.random() < 0.12:
                    quantity = max(1, quantity + random.choice([-1, 1]))
                unit = price[line["product_id"]]
                items.append(
                    {
                        "order_id": order["id"],
                        "product_id": line["product_id"],
                        "quantity": quantity,
                        "unit_price_cop": unit,
                    }
                )
                total += round(quantity * unit)
            totals[order["id"]] = total
            charges.setdefault(order["customer_id"], []).append((week, total))

        call("POST", "order_items", items, prefer="return=minimal")
        for order_id, total in totals.items():
            call("PATCH", f"orders?id=eq.{order_id}", {"total_cop": total})

        print(f"  {week}: {len(orders)} entregas")

    # ── Pagos ─────────────────────────────────────────────────
    # La mezcla que hace interesante el panel de cobros: la mayoría al día,
    # algunos con abonos parciales y unos pocos que llevan meses sin pagar.
    print("Sembrando pagos…")
    payments = []
    customers_with_charges = list(charges.items())
    random.shuffle(customers_with_charges)

    cutoff = int(len(customers_with_charges) * 0.72)
    partial_cut = cutoff + int(len(customers_with_charges) * 0.16)

    for position, (customer_id, entries) in enumerate(customers_with_charges):
        confirmed = [(w, amount) for w, amount in entries if w != weeks[-1]]
        owed = sum(amount for _, amount in confirmed)
        if owed <= 0:
            continue

        if position < cutoff:
            share = 1.0            # al día
        elif position < partial_cut:
            share = random.uniform(0.35, 0.7)   # abonó una parte
        else:
            share = 0.0            # moroso

        if share == 0.0:
            continue

        seller = random.choice(sellers)
        method = "efectivo" if random.random() < 0.55 else "transferencia"
        payments.append(
            {
                "customer_id": customer_id,
                "amount_cop": max(1, round(owed * share / 1000) * 1000),
                "method": method,
                "paid_at": (weeks[-2] + timedelta(days=random.randint(0, 4))).isoformat(),
                "received_by": seller["id"],
                "receipt_holder": seller["id"] if method == "transferencia" else None,
                "status": "confirmado",
                "reported_by": None,
                "note": None,
            }
        )

    # Un par de reportes de efectivo sin confirmar, para la bandeja de contabilidad.
    reparto = next((p for p in profiles if p["role"] == "reparto"), None)
    if reparto:
        for customer_id, _ in customers_with_charges[:2]:
            payments.append(
                {
                    "customer_id": customer_id,
                    "amount_cop": 20000,
                    "method": "efectivo",
                    "paid_at": weeks[-1].isoformat(),
                    "received_by": None,
                    "receipt_holder": None,
                    "reported_by": reparto["id"],
                    "status": "por_confirmar",
                    "note": "Recibido en la entrega",
                }
            )

    inserted = call("POST", "payments", payments, prefer="return=representation")
    created["payments"] = [p["id"] for p in inserted]
    save()
    print(f"  {len(inserted)} pagos")

    _seed_lots(created, save)

    # ── Foro ──────────────────────────────────────────────────
    notes = [
        ("queja", "Llegaron 2 cubetas con huevo partido. Reponer la próxima semana."),
        ("pendiente", "Confirmar si siguen pausados en diciembre."),
        ("idea", "Ofrecer media cubeta a los clientes que dicen que 30 les sobra."),
        ("nota", "Pidió que timbren en portería, no al apartamento."),
        ("pendiente", "Cobrar antes de fin de mes, lleva tres semanas."),
    ]
    posts = []
    for kind, body in notes:
        posts.append(
            {
                "author_id": random.choice(sellers)["id"],
                "kind": kind,
                "body": body,
                "run_id": random.choice(created["delivery_runs"]),
                "customer_id": random.choice(fijos)["id"] if random.random() < 0.7 else None,
                "resolved_at": None,
            }
        )
    inserted = call("POST", "forum_posts", posts, prefer="return=representation")
    created["forum_posts"] = [p["id"] for p in inserted]
    save()
    print(f"  {len(inserted)} notas en el foro")

    save()
    print(f"\nListo. Registro de lo sembrado en {LEDGER}")


def _seed_lots(created: dict, save) -> None:
    """Los cuatro lotes y su historia semanal de producción."""
    # ── Lotes de gallinas ─────────────────────────────────────
    # Cuatro lotes en momentos distintos del ciclo. Esto es lo que hace que la
    # curva de producción total NO sea plana, que es justo el problema a resolver.
    print("Sembrando lotes y producción…")
    # ~700 gallinas en total, repartidas en cuatro momentos del ciclo. Es lo que
    # hace que la producción semanal oscile entre 2.100 y 3.000 huevos sin que
    # nadie haya cambiado nada: simplemente los lotes envejecen a destiempo.
    # El cuarto valor es la productividad propia del lote. Dos lotes de la misma
    # edad no ponen igual —raza, alimento, época de entrada— y sin esa diferencia
    # todas las franjas del gráfico subirían y bajarían en paralelo, que es
    # justamente lo que no pasa en un galpón real.
    lots_spec = [
        ("L-2025-A", 180, 64, "Lohmann Brown", 1.06),  # buen lote, ya debió salir
        ("L-2025-B", 150, 40, "Lohmann Brown", 0.93),  # flojo desde el arranque
        ("L-2026-A", 170, 16, "Isa Brown", 1.09),      # el mejor del galpón
        ("L-2026-B", 200, 3, "Isa Brown", 0.97),       # todavía sin poner
    ]

    today = date.today()
    for code, hens, age_weeks, breed, factor in lots_spec:
        entry = today - timedelta(weeks=age_weeks)
        lot = call(
            "POST",
            "hen_lots",
            [
                {
                    "code": code,
                    "entry_date": entry.isoformat(),
                    "initial_count": hens,
                    "breed": breed,
                    "expected_exit_date": (entry + timedelta(weeks=52)).isoformat(),
                }
            ],
            prefer="return=representation",
        )[0]
        created["hen_lots"].append(lot["id"])
        save()

        events, production = [], []
        alive = hens
        for week_index in range(age_weeks + 1):
            week_start = entry + timedelta(weeks=week_index)
            if week_start > today:
                break

            # Mortalidad baja y esporádica, como en un galpón sano.
            if week_index > 0 and random.random() < 0.28:
                dead = random.randint(1, 2)
                alive -= dead
                events.append(
                    {
                        "lot_id": lot["id"],
                        "event_date": week_start.isoformat(),
                        "type": "mortalidad",
                        "quantity": dead,
                    }
                )

            week_of_year = week_start.isocalendar()[1] % 52
            normal, small = weekly_eggs(alive, week_index, factor, week_of_year)
            noise = random.uniform(0.97, 1.03)
            normal, small = round(normal * noise), round(small * noise)

            if normal > 0:
                production.append(
                    {
                        "lot_id": lot["id"],
                        "week_start": week_start.isoformat(),
                        "eggs": normal,
                        "size": "normal",
                    }
                )
            if small > 0:
                production.append(
                    {
                        "lot_id": lot["id"],
                        "week_start": week_start.isoformat(),
                        "eggs": small,
                        "size": "pequeno",
                    }
                )

        if events:
            call("POST", "hen_lot_events", events, prefer="return=minimal")
        if production:
            call("POST", "egg_production", production, prefer="return=minimal")
        print(f"  {code}: {age_weeks} semanas, {len(production)} registros")


def reseed_lots() -> None:
    """
    Rehace solo los lotes, dejando pedidos y pagos como están.

    Sirve para recalibrar el galpón —tamaño de los lotes, tasa de postura—
    sin volver a montar seis semanas de pedidos que ya estaban bien.
    """
    if not LEDGER.exists():
        sys.exit(f"No existe {LEDGER}: corre primero la siembra completa.")

    created = json.loads(LEDGER.read_text('utf-8'))

    def save() -> None:
        LEDGER.write_text(json.dumps(created, indent=2), 'utf-8')

    for lot_id in created.get('hen_lots', []):
        call("DELETE", f"hen_lots?id=eq.{lot_id}", prefer="return=minimal")
    created['hen_lots'] = []
    save()

    _seed_lots(created, save)
    print("\nLotes rehechos. Pedidos y pagos intactos.")


# ─────────────────────────────────────────────────────────────
# Limpieza
# ─────────────────────────────────────────────────────────────


def clear() -> None:
    if not LEDGER.exists():
        sys.exit(f"No existe {LEDGER}: no hay nada sembrado que borrar.")

    created = json.loads(LEDGER.read_text("utf-8"))

    # Las órdenes, sus líneas, los movimientos y la producción caen solos por
    # las llaves foráneas en cascada.
    for table, ids in [
        ("forum_posts", created.get("forum_posts", [])),
        ("payments", created.get("payments", [])),
        ("delivery_runs", created.get("delivery_runs", [])),
        ("hen_lots", created.get("hen_lots", [])),
    ]:
        if not ids:
            continue
        for chunk in [ids[i : i + 40] for i in range(0, len(ids), 40)]:
            call("DELETE", f"{table}?id=in.({','.join(chunk)})", prefer="return=minimal")
        print(f"  {table}: {len(ids)} borrados")

    LEDGER.unlink()
    print("\nDatos de demo eliminados. Los clientes reales quedaron intactos.")


def main() -> int:
    if not URL or not KEY:
        return print("Faltan NEXT_PUBLIC_SUPABASE_URL y la llave secreta.") or 1

    parser = argparse.ArgumentParser()
    parser.add_argument("--clear", action="store_true", help="borrar lo sembrado")
    parser.add_argument(
        "--lots-only",
        action="store_true",
        help="rehacer solo los lotes y su producción, sin tocar pedidos ni pagos",
    )
    args = parser.parse_args()

    if args.clear:
        clear()
    elif args.lots_only:
        reseed_lots()
    else:
        seed()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
