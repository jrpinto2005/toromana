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
PEAK_RATE = 0.72       # huevos por gallina por día en el pico (gallina campesina)
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


# Amplitud del efecto de la época. Es de segundo orden a propósito: lo que
# manda es la edad del lote, esto solo ondula la curva.
SEASON_AMPLITUDE = 0.06


def seasonal_factor(week_of_year: int) -> float:
    """
    Lo que le pasa a todo el galpón al mismo tiempo.

    Clima, calidad del alimento, horas de luz. Afecta a todos los lotes a la
    vez —de ahí que sus curvas estén correlacionadas— pero no explica por qué
    un lote sube mientras otro baja: eso lo dicta la edad de cada uno.
    """
    return 1 + SEASON_AMPLITUDE * math.sin(2 * math.pi * (week_of_year - 8) / 52)


def weekly_eggs(
    hens: int,
    weeks: float,
    lot_factor: float = 1.0,
    week_of_year: int = 0,
) -> tuple[int, int]:
    """
    Huevos de la semana repartidos en (normales, pequeños).

    `lot_factor` es lo propio del lote: raza, alimento que le tocó, época en
    que entró. Dos lotes de la misma edad no ponen igual, y sin esto todas las
    curvas del galpón subirían y bajarían en paralelo.
    """
    rate = laying_rate(weeks) * lot_factor * seasonal_factor(week_of_year)
    total = round(hens * rate * 7)
    small = round(total * small_egg_share(weeks))
    return total - small, small
