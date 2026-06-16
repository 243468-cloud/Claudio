import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB, OrderItem } from '@/lib/db';
import { requireSession } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v1/orders/[id]/items
 * Obtiene la lista de ítems de un pedido específico.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireSession(request);
    if (!auth.authorized) {
      return NextResponse.json(auth.response, { status: auth.status });
    }

    const { id } = await params;
    const db = await readDB();

    const order = db.orders.find((o) => o.id === id);
    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }

    if (auth.session.role !== 'admin' && order.customerId !== auth.session.userId) {
      return NextResponse.json(
        { error: 'Acceso prohibido. No tienes permisos para ver los ítems de este pedido.' },
        { status: 403 }
      );
    }

    return NextResponse.json(order.items);
  } catch (error) {
    console.error('Error al listar ítems del pedido:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

/**
 * POST /api/v1/orders/[id]/items
 * Agrega un nuevo ítem o aumenta la cantidad de un ítem existente en un pedido con estado 'pending'.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireSession(request);
    if (!auth.authorized) {
      return NextResponse.json(auth.response, { status: auth.status });
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'El cuerpo de la solicitud no puede estar vacío.' }, { status: 400 });
    }

    const { supplementId, quantity } = body;

    // 1. Validar parámetros del cuerpo
    if (typeof supplementId !== 'string' || !supplementId.trim()) {
      return NextResponse.json({ error: 'El campo "supplementId" es requerido.' }, { status: 422 });
    }

    if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json({ error: 'El campo "quantity" debe ser un entero mayor a cero.' }, { status: 422 });
    }

    const db = await readDB();

    // 2. Buscar el pedido
    const orderIndex = db.orders.findIndex((o) => o.id === id);
    if (orderIndex === -1) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }

    const order = db.orders[orderIndex];

    // 3. Verificar autorización
    if (auth.session.role !== 'admin' && order.customerId !== auth.session.userId) {
      return NextResponse.json(
        { error: 'Acceso prohibido. No puedes modificar este pedido.' },
        { status: 403 }
      );
    }

    // 4. Verificar que el pedido esté en estado 'pending'
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: `No se pueden agregar ítems. El pedido ya está en estado '${order.status}'.` },
        { status: 422 }
      );
    }

    // 5. Buscar el suplemento
    const supplementIndex = db.supplements.findIndex((s) => s.id === supplementId);
    if (supplementIndex === -1) {
      return NextResponse.json({ error: 'El suplemento especificado no existe.' }, { status: 404 });
    }

    const supplement = db.supplements[supplementIndex];

    // 6. Verificar stock disponible
    if (supplement.stock < quantity) {
      return NextResponse.json(
        { error: `Stock insuficiente para '${supplement.name}'. Solicitado: ${quantity}, Disponible: ${supplement.stock}.` },
        { status: 422 }
      );
    }

    // 7. Descontar stock del suplemento
    supplement.stock -= quantity;
    supplement.updatedAt = new Date().toISOString();

    // 8. Buscar si ya existe el suplemento en los ítems de esta orden
    const existingItemIndex = order.items.findIndex((item) => item.supplementId === supplementId);
    let targetItem: OrderItem;

    if (existingItemIndex > -1) {
      // Si ya existe, se suma la cantidad
      order.items[existingItemIndex].quantity += quantity;
      targetItem = order.items[existingItemIndex];
    } else {
      // Si no existe, se crea un nuevo OrderItem
      targetItem = {
        id: crypto.randomUUID(),
        supplementId,
        quantity,
        priceAtOrder: supplement.price,
      };
      order.items.push(targetItem);
    }

    // 9. Recalcular el total del pedido
    const newTotal = order.items.reduce((sum, item) => sum + item.quantity * item.priceAtOrder, 0);
    order.total = parseFloat(newTotal.toFixed(2));
    order.updatedAt = new Date().toISOString();

    db.orders[orderIndex] = order;
    await writeDB(db);

    return NextResponse.json(targetItem, { status: 201 });
  } catch (error) {
    console.error('Error al agregar ítem al pedido:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
