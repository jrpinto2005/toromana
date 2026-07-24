# Handoff — Agente B

> Este documento es tu punto de entrada. Está escrito asumiendo que **no tienes nada de
> contexto previo**. Léelo completo antes de escribir una línea de código.

## Qué estamos construyendo

Un sistema operativo para un negocio agrícola real en Bogotá que produce huevos
campesinos, moras, mermelada, miel y cítricos, y los entrega semanalmente a ~150 clientes.

Hoy todo vive en un archivo de Excel de 59 hojas: cada semana alguien clona una pestaña,
revisa WhatsApps para saber quién entra y quién sale de la lista, edita órdenes de compra
a mano en Word, y a fin de mes corre una macro para sacar la cartera. Se pierde plata:
~$580.000 sin cobrar en un solo mes, y cuentas que se dejan correr 3 o 4 meses.

Es una **hackathon de 9 horas**. El producto tiene que quedar desplegado y funcionando.

**Lee en este orden antes de arrancar:**
1. [CLAUDE.md](../CLAUDE.md) — convenciones y reglas de arquitectura
2. [SPEC.md](SPEC.md) — el dominio completo
3. [ARCHITECTURE.md](ARCHITECTURE.md) — **el esquema SQL completo está en la sección 4**
4. [PLAN.md](PLAN.md) — cronograma y qué se corta si el tiempo aprieta
5. `local/CONTEXT.local.md` — datos reales (gitignoreado, solo local)

## ⚠️ Regla de datos sensibles

El repositorio es **público** para juzgamiento. El negocio tiene ~150 clientes reales con
nombre, dirección, teléfono y NIT.

- **Nunca** escribas nombres reales en código, comentarios, docs, commits o datos de prueba
- Usa los alias: `Admin` · `Contabilidad` · `Producción` · `Reparto` para el equipo;
  `Institucional A/B/C` para los clientes grandes
- `example info/` y `local/` están en `.gitignore`. No los saques de ahí
- Los datos de la empresa (razón social, NIT, teléfonos del recibo) van en variables de
  entorno o tabla de configuración, **jamás** hardcodeados
- Antes de cada push: `git status` no debe mostrar nada de `example info/` ni de `local/`

## Reparto del trabajo

| | **Agente A** (el otro) | **Agente B** (tú) |
|---|---|---|
| Tema | Núcleo: datos y pedido semanal | Periferia: plata, documentos, producción |
| Bloques del PLAN | 0, 1, 2, 3 | 4, 5, 6, 7 |

### Lo que hace A (no lo toques)
Scaffold del proyecto · dependencias · esquema de Supabase y migraciones · auth y roles ·
layout y navegación · módulo `clients` · importador del `.xlsm` · módulo `orders` y la
pantalla del pedido semanal colaborativo.

### Lo que haces tú

**Bloque 5 · Cartera y cobros — es tu prioridad #1.** Es uno de los dos innegociables del
demo. Si solo alcanzas a hacer una cosa, que sea esta.

- `src/modules/payments/` — registrar pagos, bandeja de efectivo por confirmar, lectura de
  las vistas FIFO
- `src/app/(app)/cartera/` — panel de cobros ordenado por urgencia 🟢🟡🟠🔴⚫,
  filtrable por vendedor; estado de cuenta por cliente
- `src/modules/notifications/` — cálculo del nivel de urgencia y plantillas de mensaje
- Botón **Cobrar por WhatsApp** → abre `wa.me/<tel>?text=<mensaje>` ya redactado

**Bloque 4 · Ruta de reparto**
- `src/app/(app)/ruta/` — vista **móvil** para el repartidor: lista del día, marcar
  entregado, reportar efectivo recibido (entra como `por_confirmar`)
- `src/modules/documents/` — export de la lista: ruta HTML con `@media print` + CSV

**Bloque 6 · Órdenes de compra** (después de la línea de corte)
- Template PDF del recibo de entrega, consecutivos, duplicado para institucionales
- `src/app/(app)/ajustes/` — editar precios de lista y `next_number` de las secuencias

**Bloque 7 · Producción y analítica** (después de la línea de corte)
- `src/modules/production/` + `src/app/(app)/produccion/` — lotes de gallinas, eventos
  (mortalidad/venta/ingreso), producción semanal de huevos
- `src/app/(app)/analitica/` — tasa de postura (huevos/gallina/día), producido vs. vendido

**Utilidades tuyas**
- `src/lib/money.ts` — formateo de pesos colombianos
- `src/lib/dates.ts` — próximo lunes (sugerencia) y formateo de fechas

## Lo que ya está listo (no lo rehagas)

El scaffold, el esquema y las semillas ya están commiteados:

- **Next 16 · React 19 · Tailwind v4 · TypeScript**, App Router con `src/`
- **Todas las dependencias ya instaladas**: `@supabase/supabase-js`, `@supabase/ssr`,
  `date-fns`, `recharts`, `lucide-react`, `clsx`, `tailwind-merge`
- **shadcn/ui inicializado con 16 componentes ya agregados** en `src/components/ui/`:
  button, input, label, table, card, badge, dialog, select, checkbox, tabs, separator,
  dropdown-menu, textarea, switch, sonner, skeleton.
  Si necesitas otro, **pídeselo a A** — no corras `shadcn add` tú
- **4 migraciones en `supabase/migrations/`**, verificadas contra Postgres 15: esquema,
  vistas derivadas, RLS y semillas de catálogo

### Dos decisiones de dependencias que te afectan

- **No hay SheetJS/`xlsx`.** El import del Excel corre una sola vez como script de Python
  con `openpyxl`, fuera del bundle. Para el export de la ruta, **genera el CSV a mano**
  (es concatenar strings) — no metas una librería para eso.
- **No hay `@react-pdf/renderer`.** Los recibos y la lista de reparto son **rutas HTML con
  `@media print`**. Se imprimen directo y salen a PDF con "Guardar como PDF" del navegador.
  Cero dependencias y cero riesgo de incompatibilidad con React 19.

## Propiedad de archivos — así no nos pisamos

**Tuyos, en exclusiva:**
```
src/modules/payments/
src/modules/production/
src/modules/documents/
src/modules/notifications/
src/app/(app)/cartera/
src/app/(app)/ruta/
src/app/(app)/produccion/
src/app/(app)/analitica/
src/app/(app)/ajustes/
src/lib/money.ts
src/lib/dates.ts
```

**De A — no los edites. Si necesitas un cambio, pídeselo:**
```
package.json · package-lock.json     ← A instala TODAS las dependencias de entrada
supabase/migrations/                  ← A es el único que toca el esquema
src/lib/supabase/
src/proxy.ts                           ← guarda de sesión (Next 16 renombró middleware)
src/app/(app)/layout.tsx              ← A deja la navegación completa desde el inicio
src/app/(auth)/
src/modules/clients/
src/modules/orders/
src/modules/import/
```

Si te falta una dependencia o una columna, **no la agregues tú**: avísale a A. Dos
personas tocando `package-lock.json` o el esquema al tiempo es la forma más rápida de
perder media hora en conflictos.

## ⚠️ La regla que ya rompió el build una vez

Un componente `'use client'` **no puede importar el `index.ts` de un módulo**. Ese index
arrastra `queries.ts` → `lib/supabase/server` → `next/headers` hasta el bundle del
navegador, y el build muere con un error confuso sobre el Pages Router.

```ts
// ❌ revienta el build
import type { Payment } from '@/modules/payments'
import { listPayments } from '@/modules/payments'

// ✅
import type { Payment } from '@/modules/payments/types'
import { registerPaymentAction } from './actions'   // server action de tu ruta
```

**El patrón:** cada módulo tiene un `types.ts` sin dependencias de servidor. Los
componentes cliente importan tipos de ahí, y todo lo que toque la base pasa por un
server action declarado en el `actions.ts` de tu propia carpeta de ruta. El componente
de servidor (`page.tsx`) sí puede importar el `index.ts` y pasar los datos por props.

`lib/supabase/server.ts` importa `server-only`, así que si te saltas la regla el build
falla señalando el archivo exacto.

Mira `src/modules/clients/` y `src/app/(app)/clientes/` como referencia: `page.tsx` es
servidor y consulta, `customers-table.tsx` es cliente y solo recibe props y llama
acciones.

## Contratos — lo que A te expone

Programa contra estas firmas desde ya. Si aún no existen cuando arranques, créalas como
stub local y bórralo cuando A haga push.

```ts
// src/modules/clients/index.ts
export type Customer = {
  id: string
  name: string
  address: string | null
  phone: string | null
  sellerId: string | null
  kind: 'natural' | 'institucional'
  recurrence: 'semanal' | 'quincenal' | 'ocasional'
  requiresPurchaseOrder: boolean
  poCopies: number
  poSequence: string | null      // 'general' | 'institucional_b'
  legalName: string | null
  nit: string | null
  poNote: string | null          // nota al pie del recibo
  openingBalanceCop: number
  openingBalanceDate: string | null
  active: boolean
}
export function listCustomers(opts?: { sellerId?: string }): Promise<Customer[]>
export function getCustomer(id: string): Promise<Customer | null>

// src/modules/orders/index.ts
export type DeliveryRun = {
  id: string
  deliveryDate: string           // ISO 'YYYY-MM-DD'
  status: 'borrador' | 'confirmado' | 'entregado' | 'cerrado'
}
export type OrderItem = {
  id: string
  productId: string
  quantity: number               // admite fracciones: 0.5, 0.75
  unitPriceCop: number
  subtotalCop: number
}
export type Order = {
  id: string
  runId: string
  customerId: string
  sellerId: string | null
  status: 'pendiente' | 'entregado' | 'omitido'
  totalCop: number
  items: OrderItem[]
}
export function listRuns(): Promise<DeliveryRun[]>
export function getRun(id: string): Promise<DeliveryRun | null>
export function getRunOrders(runId: string): Promise<(Order & { customer: Customer })[]>
export function markDelivered(orderId: string): Promise<void>   // lo usa tu vista de ruta
```

**Lo único que tú le expones a A** — A lo llama al confirmar un pedido:

```ts
// src/modules/documents/index.ts
export function generatePurchaseOrdersForRun(runId: string): Promise<{ generated: number }>
```

Mientras no exista, A no llama nada y no pasa nada. Sin dependencias circulares.

## Lo que ya está resuelto en la base de datos

A crea el esquema completo (sección 4 de ARCHITECTURE.md). Lo que más te sirve:

- **`v_customer_debt`** — vista que ya calcula, por cliente: `charged_cop`, `paid_cop`,
  `balance_cop`, `oldest_unpaid_date` y `days_overdue` con lógica **FIFO**. No recalcules
  saldos en TypeScript: consulta esta vista.
- **`v_hen_lot_status`** — cantidad actual de gallinas por lote, derivada de los eventos.
- **`next_document_number(seq text)`** — función que devuelve y avanza el consecutivo de
  forma atómica. Úsala para los recibos; no leas y escribas el contador tú mismo.

Niveles de urgencia sobre `days_overdue` (calcúlalos en `notifications`, no en SQL —
son regla de negocio y van a cambiar):

| Nivel | Días |
|---|---|
| 🟢 Al día | sin saldo |
| 🟡 Reciente | 1–30 |
| 🟠 Atención | 31–60 |
| 🔴 Urgente | 61–90 |
| ⚫ Crítico | > 90 |

## Reglas de dominio que te van a morder si no las sabes

- **Dinero**: enteros en pesos colombianos, sin decimales. Sufijo `_cop`. Nunca `float`.
- **Cantidades**: `numeric(10,2)`. Media cubeta de huevos (`0.5`) es una venta real.
- **Saldos**: se **derivan** de las vistas, nunca se almacenan.
- **Precios**: congelados en `order_items.unit_price_cop`. No los recalcules desde el
  precio de lista al mostrar histórico.
- **Pagos**: método `efectivo` o `transferencia`. El campo "quién tiene el comprobante"
  aplica **solo** a transferencias. El repartidor inserta siempre `por_confirmar`;
  contabilidad confirma. El repartidor nunca escribe en la contabilidad.
- **Recibos**: dos secuencias independientes, `general` e `institucional_b`, con números
  distintos. Los institucionales llevan `po_copies = 2`.
- **Idioma**: UI en español, código en inglés.

## Protocolo de git

- Rama `main`, commits **pequeños y temáticos**. Nada de un commit gigante al final.
- Conventional commits: `feat(payments): ...`, `fix(ruta): ...`, `feat(documents): ...`
- Antes de cada push: `git pull --rebase`. Con la propiedad de archivos respetada, los
  conflictos deberían ser cero.
- Push seguido. El deploy es continuo y queremos ver la app viva todo el tiempo.
- Corre `npm run build` antes de empujar: un build roto tumba producción.

## Orden sugerido de arranque

Mientras A termina el scaffold (primeros ~40 min), puedes escribir sin bloquearte:

1. `src/lib/money.ts` y `src/lib/dates.ts` — puro, sin dependencias
2. `src/modules/notifications/` — niveles de urgencia y plantillas de WhatsApp: funciones
   puras que reciben datos y devuelven strings. Testeables sin base de datos
3. Las vistas de impresión de `src/modules/documents/` — son componentes React con
   estilos `@media print`, no necesitan datos reales para maquetarse

Cuando A haga push del scaffold y el esquema, cableas todo eso y sigues con `payments`,
que es tu prioridad real.
