#!/usr/bin/env python3
"""
Curva de postura por edad del lote.

Es la misma forma que usa la app para proyectar (ver src/modules/production/
curve.ts). Vive aquí duplicada a propósito: este script solo siembra datos de
demostración y no debe arrastrar el runtime de la aplicación.

La curva tiene cuatro tramos que cualquiera que críe gallinas reconoce:

    │        ╭─────────────╮
    │       ╱               ╲___
    │      ╱                     ╲___
    │_____╱                           ╲
    └──────────────────────────────────────
     sin    subida    meseta      declive
    postura

`t` son semanas desde que el lote entró al galpón.
"""

from __future__ import annotations

import math

# Gallinas que entran ya casi en edad de postura: arrancan a las pocas semanas.
ONSET_WEEKS = 5.0      # cuándo empieza a levantar la curva
RAMP = 1.7             # qué tan rápida es la subida
PEAK_RATE = 0.93       # huevos por gallina por día en el pico
PLATEAU_WEEKS = 28.0   # hasta cuándo se sostiene el pico
DECLINE = 0.0042       # caída semanal después de la meseta
SMALL_EGG_DECAY = 5.0  # qué tan rápido deja de poner huevo pequeño


def laying_rate(weeks: float) -> float:
    """Huevos por gallina por día a las `weeks` semanas en galpón."""
    if weeks < 0:
        return 0.0
    ramp = 1.0 / (1.0 + math.exp(-(weeks - ONSET_WEEKS) / RAMP))
    decline = math.exp(-DECLINE * max(0.0, weeks - PLATEAU_WEEKS))
    return PEAK_RATE * ramp * decline


def small_egg_share(weeks: float) -> float:
    """
    Proporción de huevo pequeño.

    Los lotes nuevos ponen casi todo pequeño y van creciendo el calibre. Es lo
    que obliga a llevar la producción separada por tamaño.
    """
    if weeks <= ONSET_WEEKS:
        return 1.0
    return max(0.0, min(1.0, math.exp(-(weeks - ONSET_WEEKS) / SMALL_EGG_DECAY)))


def weekly_eggs(hens: int, weeks: float) -> tuple[int, int]:
    """Huevos de la semana repartidos en (normales, pequeños)."""
    total = round(hens * laying_rate(weeks) * 7)
    small = round(total * small_egg_share(weeks))
    return total - small, small
