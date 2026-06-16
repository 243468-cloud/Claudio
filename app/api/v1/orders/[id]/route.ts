import { NextRequest, NextResponse } from 'next/server';
import { readDB } from '@/lib/db';
import { requireSession } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v1/orders/[id]
 * Retorna los detalles de un pedido específico.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    // 1. Verificar autenticación
    const auth = requireSession(request);
    if (!auth.authorized) {
      return NextResponse.json(auth.response, { status: auth.status });
    }

    const { id } = await params;
    const db = await readDB();

    // 2. Buscar el pedido
    const order = db.orders.find((o) => o.id === id);
    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }

    // 3. Verificar autorización (Si es customer, debe ser el dueño del pedido)
    if (auth.session.role !== 'admin' && order.customerId !== auth.session.userId) {
      return NextResponse.json(
        { error: 'Acceso prohibido. No tienes permisos para ver este pedido.' },
        { status: 403 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error al obtener detalle de pedido:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
