<img src="./project-logo.png" alt="Toromana" width="140" />

# Toromana

**El sistema operativo de una finca real.** Pedidos, reparto, cartera — y un
modelo que le dice cuándo comprar el próximo lote de gallinas.

🔗 **[toromana.vercel.app](https://toromana.vercel.app)**

Platanus Build Night · Bogotá @ Buk — Julian Rafael Pinto
([@jrpinto2005](https://github.com/jrpinto2005))

---

## El problema

Una finca a las afueras de Bogotá le vende huevos, moras y miel a unos 150
clientes todas las semanas. Todo vive en un archivo de Excel de **59 hojas**:

- Cada semana alguien clona una pestaña y **revisa WhatsApps** para saber quién
  entra y quién sale de la lista.
- Las órdenes de compra se editan **a mano en Word**: cambiar la fecha, el
  consecutivo, las cantidades.
- A fin de mes se corre **una macro** que agrega por nombre para sacar la cartera.

Lo que eso cuesta, medido sobre el archivo real:

| | |
|---|---|
| Cartera sin cobrar en un solo mes | **$580.000**, repartidos en 6 clientes |
| Clientes duplicados que parten la deuda | el mismo nombre con un espacio de más aparece como dos filas |
| Datos escondidos en texto | `"Nombre: 2 huevos"`, `"Nombre c/ 15 días"` |

Y el costo que no se mide: si un cliente se cae de la lista semanal, **no recibe
producto y nadie se entera**.

## Qué hace

**El pedido de la semana se arma solo.** Entran los clientes fijos con su pedido
habitual, al último precio que se les cobró — así un institucional con tarifa
pactada vuelve a salir a su tarifa sin mantener tabla de precios. Los tres
vendedores lo editan **al mismo tiempo**, en vivo. Quien está en pausa aparece
**en gris con el motivo**, no desaparece: que un cliente no esté esta semana
tiene que ser una decisión visible.

**Los papeles salen como los de siempre.** La lista de reparto y los recibos que
firma el hotel replican el documento que reemplazan, con consecutivos
automáticos. Un papel que se ve distinto cada semana genera preguntas en la
recepción.

**La cartera se ordena sola.** Los pagos se aplican al saldo más antiguo primero,
así el panel de cobros se ordena por hace-cuánto-deben y no por quién se acordó
de mirar. Un toque abre WhatsApp con el mensaje escrito y la cuenta bancaria que
corresponde — la de la empresa si es institucional, la simple si es persona.

**Y el planificador de producción**, que es lo que no es un CRUD.

## El planificador

Una gallina no pone parejo. Sube a un pico, **entra en muda y cae a la mitad**,
vuelve a un segundo pico casi igual, y solo entonces decae. Se vende antes de
llegar a cero.

```
100 │        ╭─────╮                 ╭────╮
    │      ╭─╯      ╲               ╱      ╲___
 50 │   ╱             ╲──────╱                  ╲___  ● se vende
  0 │──────
    └───┬────┬────┬────┬────┬────┬────┬────┬────┬────
    0   6   12   16   22   30   35   40   43   56  semanas
```

Como el galpón tiene varios lotes de edades distintas, la producción total nunca
es plana. Y **comprar en el momento equivocado apila el valle del lote nuevo
sobre el de uno viejo** y deja un hueco peor que el original.

El planificador ajusta esa curva a los registros de la finca —separando lo que
es propio de cada lote de lo que le pasa a todo el galpón a la vez— y busca
semana y tamaño de compra para **escalonar los lotes de modo que el pico de uno
tape el valle de otro**.

Sobre el galpón sembrado, con meta de 2.150 huevos/semana a 78 semanas:

| | Sin comprar | Con el plan |
|---|---|---|
| Desviación media | se va a cero al envejecer los lotes | **119 huevos/semana** |

El plan que encuentra son cuatro compras escalonadas cada ~16 semanas. **Esa
cadencia no está programada** — sale del optimizador.

El modelo dice en pantalla cuánto sabe: con poca historia se apoya en el
comportamiento típico de la especie y lo declara, en vez de presentar un supuesto
como si fuera aprendizaje.

## Cómo está hecho

**Next.js 16 · React 19 · Supabase · Vercel.** Monolito modular: la lógica vive
en `src/modules/<dominio>` y las rutas solo orquestan. **$0 al mes** — el negocio
no tenía presupuesto, y esa fue una restricción de diseño, no un detalle.

Decisiones que valen la pena:

- **Los saldos se derivan**, nunca se almacenan. Un saldo guardado se
  desincroniza — es exactamente lo que le pasa hoy a la macro de Excel.
- **Sin geocodificación.** Las direcciones aquí son «Parex», «Edificio», «Debajo
  de la casa». Un geocodificador devolvería puntos inventados, y un pin inventado
  en un mapa de reparto es peor que ningún pin: se marcan a mano, una vez.
- **Reparto no escribe en contabilidad.** Reporta el efectivo que recibe y
  contabilidad lo confirma. A nivel de base de datos, no solo escondido en la UI.
- **Sin datos reales en el repositorio.** ~150 personas con nombre, dirección y
  teléfono; los documentos usan alias y los archivos fuente están gitignoreados.

```bash
npm install
cp .env.example .env.local   # URL y llaves de Supabase
npm run dev
```

Migraciones en `supabase/migrations/`, en orden. Documentación en
[`docs/`](docs/): [SPEC](docs/SPEC.md) para el dominio,
[ARCHITECTURE](docs/ARCHITECTURE.md) para el esquema.
