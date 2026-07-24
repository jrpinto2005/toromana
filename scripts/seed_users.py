#!/usr/bin/env python3
"""
Crea los usuarios del equipo en Supabase Auth y su fila en `profiles`.

    python3 scripts/seed_users.py

Lee local/users.json, que está gitignoreado porque lleva correos reales.
Formato:

    [
      {"email": "...", "full_name": "Admin",        "role": "admin",        "is_seller": true},
      {"email": "...", "full_name": "Contabilidad", "role": "contabilidad", "is_seller": true},
      {"email": "...", "full_name": "Producción",   "role": "produccion",   "is_seller": true},
      {"email": "...", "full_name": "Reparto",      "role": "reparto",      "is_seller": false}
    ]

Si una entrada no trae "password", se genera una y se imprime UNA sola vez.
No se guarda en ningún archivo: se copia y se reparte por un canal privado.

El registro público está cerrado, así que esta es la única forma de crear cuentas.
"""

from __future__ import annotations

import json
import os
import secrets
import string
import sys
import urllib.error
import urllib.request
from pathlib import Path

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
    "SUPABASE_SECRET_KEY", ""
)

ALPHABET = string.ascii_letters + string.digits


def call(method: str, path: str, body=None, prefer: str | None = None):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer

    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        raise RuntimeError(f"{method} {path} → {e.code}: {detail}") from None


def main() -> int:
    if not URL or not KEY:
        return print("Faltan NEXT_PUBLIC_SUPABASE_URL y la llave secreta.") or 1

    path = Path("local/users.json")
    if not path.exists():
        return print(f"No existe {path}. Mira el encabezado de este script.") or 1

    users = json.loads(path.read_text("utf-8"))
    created = []

    for u in users:
        password = u.get("password") or "".join(
            secrets.choice(ALPHABET) for _ in range(16)
        )

        try:
            account = call(
                "POST",
                "/auth/v1/admin/users",
                {
                    "email": u["email"],
                    "password": password,
                    "email_confirm": True,
                },
            )
        except RuntimeError as e:
            # Volver a correr el script no debe reventar por los que ya existen.
            if "already" in str(e).lower():
                print(f"  {u['full_name']}: ya existía, lo salto")
                continue
            raise

        call(
            "POST",
            "/rest/v1/profiles",
            {
                "id": account["id"],
                "full_name": u["full_name"],
                "role": u["role"],
                "is_seller": u.get("is_seller", False),
            },
            prefer="return=minimal",
        )
        created.append((u["email"], u["full_name"], u["role"], password))

    if not created:
        print("\nNo se creó ningún usuario nuevo.")
        return 0

    print("\n" + "=" * 64)
    print("CONTRASEÑAS — se muestran una sola vez, no quedan guardadas")
    print("=" * 64)
    for email, name, role, password in created:
        print(f"  {name:<14} {role:<14} {email:<34} {password}")
    print("=" * 64)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
