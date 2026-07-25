#!/usr/bin/env python3
"""
Curva de postura por edad del lote.

Misma forma que usa la app (ver src/modules/production/curve.ts). Vive aquí
duplicada a propósito: este script solo siembra datos y no debe arrastrar el
runtime de la aplicación.

Un lote pasa por DOS ciclos, no uno. Sube a su primer pico, entra en muda —cae
a la mitad mientras renueva plumaje— y vuelve a un segundo pico casi tan bueno.
Solo después decae, y se vende antes de que llegue a cero.

  % del máximo del lote
  100 │        ╭─────╮                 ╭────╮
      │      ╭─╯      ╲               ╱      ╲___
   75 │     ╱           ╲            ╱            ╲___
      │    ╱              ╲         ╱                  ╲___
   50 │   ╱                ╲──────╱                         ●  se vende
      │  ╱
    0 │──────
      └───┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬───
      0   6   12   16   22   26   30   35   40   43   50   56  semanas

El valle es la razón de ser del planificador: comprando lotes desfasados, el
pico de uno cae sobre el valle de otro y la suma se aplana.
"""

from __future__ import annotations

import math

PEAK_RATE = 0.85       # huevos por gallina por día en el punto más alto
RISE_MID = 9.8         # semana en que va por la mitad de la subida
RISE_STEEP = 1.7
MOLT_DEPTH = 0.65      # cuánto cae en la muda, como fracción del máximo
MOLT_START = 26.0
MOLT_END = 35.0
MOLT_RAMP = 2.2
DECLINE_START = 43.0
DECLINE_RATE = 0.0533  # llega a la mitad hacia la semana 56

SEASON_AMPLITUDE = 0.06


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def relative_rate(
    weeks: float,
    rise_mid: float = RISE_MID,
    molt_start: float = MOLT_START,
    molt_end: float = MOLT_END,
    molt_depth: float = MOLT_DEPTH,
) -> float:
    """Producción relativa al máximo del lote, entre 0 y 1."""
    if weeks < 0:
        return 0.0

    rise = _sigmoid((weeks - rise_mid) / RISE_STEEP)

    # Valle de fondo plano: dos sigmoides opuestas abren y cierran la muda.
    molt = 1 - molt_depth * _sigmoid((weeks - molt_start) / MOLT_RAMP) * _sigmoid(
        (molt_end - weeks) / MOLT_RAMP
    )

    decline = math.exp(-DECLINE_RATE * max(0.0, weeks - DECLINE_START))
    return max(0.0, rise * molt * decline)


def small_egg_share(
    weeks: float, rise_mid: float = RISE_MID, molt_end: float = MOLT_END
) -> float:
    """
    Huevo pequeño: mucho al arrancar y otra vez, menos, al volver de la muda.
    La gallina que reinicia postura tarda semanas en recuperar calibre.
    """
    early = math.exp(-max(0.0, weeks - rise_mid + 4) / 5)
    after_molt = 0.35 * math.exp(-(((weeks - molt_end) / 3.5) ** 2))
    return max(0.0, min(1.0, early + after_molt))


def seasonal_factor(week_of_year: int) -> float:
    """
    Lo que le pasa a todo el galpón al mismo tiempo: clima, alimento, luz.
    Afecta a todos los lotes a la vez, pero no explica por qué uno sube
    mientras otro baja — eso lo dicta la edad de cada uno.
    """
    return 1 + SEASON_AMPLITUDE * math.sin(2 * math.pi * (week_of_year - 8) / 52)


def weekly_eggs(
    hens: int,
    weeks: float,
    lot_factor: float = 1.0,
    week_of_year: int = 0,
    rise_mid: float = RISE_MID,
    molt_start: float = MOLT_START,
    molt_end: float = MOLT_END,
    molt_depth: float = MOLT_DEPTH,
) -> tuple[int, int]:
    """
    Huevos de la semana, repartidos en (normales, pequeños).

    Cada lote trae su propio `lot_factor` y su propia fecha de muda: dos lotes
    idénticos en el papel no mudan la misma semana ni caen lo mismo, y sin esa
    variación las curvas del galpón se ven artificialmente paralelas.
    """
    rate = (
        PEAK_RATE
        * relative_rate(weeks, rise_mid, molt_start, molt_end, molt_depth)
        * lot_factor
        * seasonal_factor(week_of_year)
    )
    total = round(hens * rate * 7)
    small = round(total * small_egg_share(weeks, rise_mid, molt_end))
    return total - small, small
