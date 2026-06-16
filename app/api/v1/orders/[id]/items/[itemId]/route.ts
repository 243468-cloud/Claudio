import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
import { requireSession } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

/**
 * DELETE /api/v1/orders/[id]/items/[itemId]
 * Elimina un ítem específico de un pedido y restaura el stock del suplemento correspondiente.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    // 1. Verificar autenticación
    const auth = requireSession(request);
    if (!auth.authorized) {
      return NextResponse.json(auth.response, { status: auth.status });
    }

    const { id, itemId } = await params;
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
        { error: 'Acceso prohibido. No tienes permisos para modificar este pedido.' },
        { status: 403 }
      );
    }

    // 4. Verificar que el pedido esté 'pending'
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: `No se puede eliminar el ítem porque el pedido ya está en estado '${order.status}'.` },
        { status: 409 }
      );
    }

    // 5. Buscar el ítem en el pedido
    const itemIndex = order.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Ítem no encontrado en este pedido.' }, { status: 404 });
    }

    const targetItem = order.items[itemIndex];

    // 6. Restaurar el stock al suplemento correspondiente
    const supplement = db.supplements.find((s) => s.id === targetItem.supplementId);
    if (supplement) {
      supplement.stock += targetItem.quantity;
      supplement.updatedAt = new Date().toISOString();
    }

    // 7. Eliminar el ítem del listado
    order.items.splice(itemIndex, 1);

    // 8. Recalcular el total del pedido
    const newTotal = order.items.reduce((sum, item) => sum + item.quantity * item.priceAtOrder, 0);
    order.total = parseFloat(newTotal.toFixed(2));
    order.updatedAt = new Date().toISOString();

    db.orders[orderIndex] = order;
    await writeDB(db);

    // Retorna 204 No Content
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error al eliminar ítem del pedido:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
