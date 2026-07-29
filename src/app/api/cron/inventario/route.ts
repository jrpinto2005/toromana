import { NextResponse } from 'next/server'
import { listLowStockAsService } from '@/modules/inventory'
import { appUrl, listTeamContacts, sendEach } from '@/modules/email'
import { formatQuantity } from '@/lib/money'

export const dynamic = 'force-dynamic'

/**
 * Aviso automático de inventario.
 *
 * Lo dispara el cron de Vercel (ver vercel.json). Revisa qué está en el punto
 * de reposición o por debajo y le escribe a quien puede hacer algo al
 * respecto: administración, contabilidad y producción. Reparto no recibe —
 * no compra nada.
 *
 * Si no hay nada escaso, no manda nada. Un correo semanal diciendo "todo
 * bien" se convierte en un correo que nadie abre, y el día que traiga algo
 * importante tampoco lo van a abrir.
 */
export async function GET(request: Request) {
  // Vercel firma sus llamadas de cron con este encabezado. Sin la guarda, la
  // ruta queda abierta a internet y cualquiera puede provocar correos.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  try {
    const low = await listLowStockAsService()

    if (low.length === 0) {
      return NextResponse.json({ checked: true, low: 0, sent: 0 })
    }

    const contacts = await listTeamContacts([
      'admin',
      'contabilidad',
      'produccion',
    ])

    if (contacts.length === 0) {
      return NextResponse.json({
        checked: true,
        low: low.length,
        sent: 0,
        note: 'Nadie del equipo tiene correo configurado.',
      })
    }

    const rows = low.map((item) => ({
      label: item.name,
      value: `${formatQuantity(item.stock)} ${item.unit} (avisa bajo ${formatQuantity(item.reorderPoint)})`,
      alert: true,
    }))

    const results = await sendEach(
      contacts.map((contact) => ({
        to: [contact],
        subject:
          low.length === 1
            ? `Se está acabando: ${low[0].name}`
            : `${low.length} ítems por reponer`,
        heading:
          low.length === 1
            ? `${low[0].name} está en el punto de reposición`
            : `${low.length} ítems están en el punto de reposición`,
        paragraphs: [
          'Esto es lo que hay que reponer antes del próximo pedido:',
        ],
        rows,
        action: { label: 'Ver el inventario', url: appUrl('/inventario') },
      })),
    )

    const sent = results.filter((r) => r.status === 'enviado').length
    const failed = results.filter((r) => r.status !== 'enviado')
    for (const f of failed) {
      console.error('[cron inventario] no enviado:', f.reason)
    }

    return NextResponse.json({
      checked: true,
      low: low.length,
      sent,
      failed: failed.length,
    })
  } catch (e) {
    console.error('[cron inventario] falló la revisión', e)
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
