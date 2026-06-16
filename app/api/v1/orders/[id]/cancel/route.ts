import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
import { requireSession } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/v1/orders/[id]/cancel
 * Cancela un pedido y restaura el stock de los suplementos correspondientes.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // 1. Verificar autenticación
    const auth = requireSession(request);
    if (!auth.authorized) {
      return NextResponse.json(auth.response, { status: auth.status });
    }

    const { id } = await params;
    const db = await readDB();

    // 2. Buscar el pedido
    const orderIndex = db.orders.findIndex((o) => o.id === id);
    if (orderIndex === -1) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }

    const order = db.orders[orderIndex];

    // 3. Verificar autorización (Si es customer, debe ser el dueño del pedido)
    if (auth.session.role !== 'admin' && order.customerId !== auth.session.userId) {
      return NextResponse.json(
        { error: 'Acceso prohibido. No tienes permisos para cancelar este pedido.' },
        { status: 403 }
      );
    }

    // 4. Verificar estado de transición (Solo se puede cancelar si está 'pending')
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: `No se puede cancelar el pedido porque su estado actual es '${order.status}'.` },
        { status: 409 }
      );
    }

    // 5. Restaurar el stock de los suplementos
    for (const item of order.items) {
      const supplement = db.supplements.find((s) => s.id === item.supplementId);
      if (supplement) {
        supplement.stock += item.quantity;
        supplement.updatedAt = new Date().toISOString();
      }
    }

    // 6. Cambiar el estado del pedido
    order.status = 'cancelled';
    order.updatedAt = new Date().toISOString();

    db.orders[orderIndex] = order;
    await writeDB(db);

    return NextResponse.json({
      message: 'Pedido cancelado con éxito y stock restaurado.',
      order,
    });
  } catch (error) {
    console.error('Error al cancelar pedido:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
