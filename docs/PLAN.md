# Toromana — Plan de ejecución (9 horas)

## Reglas del día

1. **Deploy en la primera hora, no en la última.** El error clásico de hackathon es
   construir 8 horas y descubrir a las 8:30 que el build de producción falla. La primera
   pantalla que se despliega es un "hola mundo" — de ahí en adelante cada bloque va a
   producción.
2. **Timeboxing duro.** Si un bloque se pasa 15 minutos de su ventana, se corta lo que
   falte y se sigue. La sección *Si vas tarde* de cada bloque ya dice qué sacrificar.
3. **Cero refactors.** Código feo que funciona le gana a código bonito a medias.
   Lo que hay que cuidar son las **fronteras entre módulos** — eso sí, siempre.
4. **Commit por bloque, mínimo.** Un `git push` que rompa producción se revierte en 30 s
   si hay historia limpia.
5. **Datos reales desde el bloque 2.** Nada de `Cliente de prueba 1`. El demo se gana
   mostrando que un cliente debe $100.000 desde hace meses — eso es cierto y se ve.

## Setup previo (antes de que arranque el reloj)

Según el README de la organización, Vercel no puede conectarse al repo de la org.
Espejo a repo personal:

```bash
git remote set-url --add --push origin https://github.com/platanus-build-night/platanus-build-night-26-co-jrpinto2005.git
git remote set-url --add --push origin https://github.com/<tu-user>/toromana.git
```

Un `git push` actualiza los dos. Vercel se conecta al personal.

---

## Bloque 0 · Fundaciones — `0:00 → 0:40`

- [ ] `create-next-app` (TypeScript, Tailwind, App Router) + shadcn/ui init
- [ ] Proyecto en Supabase, correr la migración completa de [ARCHITECTURE.md](ARCHITECTURE.md#4-esquema-de-base-de-datos)
- [ ] Semillas: 6 productos con precio de lista, 4 usuarios en `auth.users` + `profiles`,
      2 filas en `document_sequences`
- [ ] Variables de entorno en Vercel, deploy inicial

> ✅ **Checkpoint:** URL pública en vivo que dice "Toromana". Sin esto no se avanza.

---

## Bloque 1 · Auth y shell — `0:40 → 1:20`

- [ ] Login email + contraseña, signup cerrado
- [ ] Middleware que protege `(app)/`
- [ ] Layout con navegación que cambia según `role`
- [ ] Reparto entra directo a `/ruta` (es lo único que necesita)

> ✅ **Checkpoint:** los 4 usuarios entran y cada uno ve un menú distinto.
>
> ⚠️ **Si vas tarde:** deja un solo layout para todos y esconde ítems con un `if`.
> No construyas un sistema de permisos.

---

## Bloque 2 · Clientes e importación — `1:20 → 2:20`

- [ ] Listado de clientes con búsqueda, filtro por vendedor y por tipo
- [ ] Formulario de cliente (crear/editar), incluye teléfono, tipo, recurrencia, pausas
- [ ] **Importador del `.xlsm`**: `CONTACTOS` → clientes · `Fijos` → clientes +
      `standing_order_items` · columna `Debe` de la última hoja mensual → saldo inicial
- [ ] Pantalla de asignación masiva de vendedor (checkboxes + "asignar a…")

> ✅ **Checkpoint:** 149 clientes, 33 pedidos fijos y los saldos reales de junio en la BD.
>
> ⚠️ **Si vas tarde:** corre el importador **una vez desde un script local** contra
> Supabase y sáltate la UI de importación. El demo no necesita ver el import; necesita
> ver los datos adentro.

---

## Bloque 3 · Pedido semanal colaborativo — `2:20 → 4:30` ⭐

**El corazón del producto.** Si algo se lleva tiempo extra, que sea esto.

- [ ] Crear pedido: date picker pre-llenado con el próximo lunes, editable a mano
- [ ] **Generación automática**: fijos semanales + quincenales que les toca,
      excluyendo pausas activas
- [ ] Clientes pausados visibles **en gris con el motivo**, no ocultos
- [ ] Edición: agregar cliente ocasional (buscador), quitar, ajustar cantidades
      (acepta `0.5`), ajustar precio de línea con aviso si difiere de lista
- [ ] Sugerir el último precio cobrado a ese cliente (así el precio especial de un
      institucional aparece solo, sin configurar tarifas)
- [ ] **Realtime**: suscripción a `orders` y `order_items` por `run_id`
- [ ] Confirmar: congelar precios, calcular `total_cop`, cambiar estado

> ✅ **Checkpoint:** dos navegadores lado a lado. Agregas un cliente en uno y aparece
> en el otro sin refrescar. **Este es el momento que gana el demo.**
>
> ⚠️ **Si vas tarde:** sacrifica el Realtime antes que la generación automática.
> Un botón de "actualizar" es aceptable; que la lista semanal se arme sola, no es
> negociable — es el problema que vinimos a resolver.

---

## Bloque 4 · Ruta de reparto — `4:30 → 5:10`

- [ ] Export PDF de la lista (nombre · dirección · productos · cantidades + totales),
      con el mismo espíritu de `ejemplo lista pdf.pdf`
- [ ] Export CSV/Excel
- [ ] Vista móvil de Reparto: lista del día, marcar entregado, reportar efectivo recibido
      (entra como `por_confirmar`)

> ✅ **Checkpoint:** el PDF se imprime y Reparto podría salir con él hoy.
>
> ⚠️ **Si vas tarde:** deja solo el CSV. El PDF bonito es 30 min que quizá rindan más
> en cartera.

---

## Bloque 5 · Cartera y cobros — `5:10 → 6:40` ⭐

**El segundo innegociable.** Aquí está la plata que hoy se pierde.

- [ ] Registrar pago: monto, método, quién recibió, quién tiene el comprobante
      (solo transferencia), fecha, nota
- [ ] Bandeja de **efectivo por confirmar** para Contabilidad (confirmar / corregir)
- [ ] Vistas FIFO de la BD → saldo y `days_overdue` por cliente
- [ ] **Panel de cobros** ordenado por urgencia 🟢🟡🟠🔴⚫, filtrable por vendedor.
      Cada vendedor ve sus clientes; Admin y Contabilidad ven todos
- [ ] Botón **Cobrar por WhatsApp** → `wa.me` con el mensaje ya redactado
- [ ] Estado de cuenta por cliente: cargos, pagos, saldo

> ✅ **Checkpoint:** un cliente aparece en ⚫ con sus $100.000 reales, y el botón de
> WhatsApp abre el mensaje escrito.
>
> ⚠️ **Si vas tarde:** el estado de cuenta detallado puede esperar. El panel de urgencia
> y el botón de WhatsApp, no.

---

# ═══ LÍNEA DE CORTE — `6:40` ═══

Hasta aquí el producto **ya cumple lo que el negocio necesita** y el demo se sostiene solo.
Todo lo que sigue suma, pero se sacrifica sin dolor.

---

## Bloque 6 · Órdenes de compra — `6:40 → 7:25`

- [ ] Ajustes: editar `next_number` de las secuencias `general` e `institucional_b`
- [ ] Template PDF del recibo (encabezado razón social · NIT · marca,
      datos de contacto, tabla de productos, línea de firma)
- [ ] Generar al confirmar el pedido, para clientes con `requires_purchase_order`
- [ ] Duplicado para institucionales · nota al pie configurable (comodato de Institucional B)

> ✅ **Checkpoint:** el PDF de Institucional A sale igual al de referencia, con consecutivo nuevo.

---

## Bloque 7 · Producción y analítica — `7:25 → 8:10`

- [ ] Lotes: crear, ver cantidad actual derivada de eventos
- [ ] Registrar mortalidad / venta / ingreso
- [ ] Producción semanal de huevos por lote
- [ ] **Tasa de postura** (huevos/gallina/día) por lote y en el tiempo
- [ ] Producido vs. vendido por semana

> ✅ **Checkpoint:** se registra un lote y una semana de producción, y se ve la métrica.
>
> ⚠️ **Si vas tarde:** solo el CRUD de lotes y el número de tasa de postura, sin gráficas.
> Un número grande y bien puesto comunica igual que una curva.

---

## Bloque 8 · Cierre y demo — `8:10 → 9:00`

- [ ] Sembrar los datos del demo (un pedido confirmado, pagos, deuda vieja)
- [ ] `build-night-project.json`: llenar `project-description`
- [ ] README conciso: problema, solución, stack, cómo correrlo
- [ ] Deploy final + **smoke test entrando con los 4 usuarios**
- [ ] Ensayar el guion una vez, con reloj

---

## Guion de demo (3 minutos)

1. **El dolor** (20 s) — Se muestra el `.xlsm` real: 59 hojas, la macro, los $480.000 en
   la columna `Debe`. *"Así se maneja hoy un negocio de verdad."*
2. **El pedido semanal** (60 s) — Crear pedido: la app propone el martes porque el lunes
   es festivo. La lista se arma sola con 33 clientes fijos; dos están en gris porque
   pidieron pausa. **Segunda pantalla al lado**: Producción agrega un ocasional y aparece
   en vivo. Confirmar → PDF de ruta para Reparto.
3. **La cartera** (60 s) — Panel de cobros: un cliente en ⚫, $100.000, 90+ días.
   Un clic → WhatsApp con el mensaje escrito. Reparto reporta efectivo desde el móvil,
   Contabilidad lo confirma, el saldo baja.
4. **El cierre** (20 s) — La orden de compra de Institucional A generada con su consecutivo,
   y la tasa de postura de los lotes. *"Y todo esto corre en $0 al mes."*

**La frase que amarra todo:** *no es un CRUD, es el reemplazo de un archivo de Excel de
59 hojas que hoy está perdiendo medio millón de pesos por trimestre.*

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Realtime de Supabase da guerra | Media | Cortar a polling de 3 s. Visualmente idéntico en el demo |
| El `.xlsm` no parsea limpio | Media | Ya está verificado con `openpyxl`. Fallback: correr el import por script local |
| PDFs consumen más de lo previsto | Alta | Están **después** de la línea de corte a propósito |
| El deploy falla al final | Baja | Neutralizada: se despliega desde el bloque 0 |
| Ambición: intentar los 8 bloques | **Alta** | La línea de corte de las 6:40 es un compromiso, no una sugerencia |

## Estado de las decisiones

| Tema | Decisión |
|---|---|
| Arquitectura | Monolito modular, extraíble a servicios |
| Stack | Next.js 15 + Supabase + Vercel · $0/mes |
| MVP innegociable | Pedido semanal colaborativo + cartera y cobros |
| WhatsApp | Links `wa.me` pre-escritos |
| Rol de Reparto | Vista móvil, reporta efectivo, Contabilidad confirma |
| Descuentos | Precio editable en la línea, sugiere el último cobrado |
| Auth | Email + contraseña, 4 usuarios sembrados, sin registro |
| Día de entrega | Fecha manual, pre-llenada con el próximo lunes |
| Consecutivos | Secuencias `general` e `institucional_b` independientes y configurables |
| Deduplicación de clientes | **No automática** — la limpieza se hace a mano |
| Cliente repetido en un pedido | Bloqueado por la base (`unique(run_id, customer_id)`) |
