import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB, Order, OrderItem } from '@/lib/db';
import { requireSession } from '@/lib/auth';

/**
 * GET /api/v1/orders (Administración)
 * Retorna todos los pedidos. Requiere rol 'admin'.
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación y autorización (Solo admin)
    const auth = requireSession(request, 'admin');
    if (!auth.authorized) {
      return NextResponse.json(auth.response, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const pageStr = searchParams.get('page') || '1';
    const limitStr = searchParams.get('limit') || '10';
    const status = searchParams.get('status')?.toLowerCase();
    const customerId = searchParams.get('customerId');

    const page = parseInt(pageStr, 10);
    const limit = parseInt(limitStr, 10);

    if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
      return NextResponse.json(
        { error: 'Los parámetros de paginación (page, limit) deben ser números enteros positivos.' },
        { status: 400 }
      );
    }

    const db = await readDB();
    let filteredOrders = [...db.orders];

    // Aplicar filtros si existen
    if (status) {
      filteredOrders = filteredOrders.filter((o) => o.status === status);
    }

    if (customerId) {
      filteredOrders = filteredOrders.filter((o) => o.customerId === customerId);
    }

    // Paginación
    const totalItems = filteredOrders.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = filteredOrders.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error('Error al listar pedidos:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

/**
 * POST /api/v1/orders
 * Crea un nuevo pedido para el usuario autenticado.
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación (Cualquier usuario autenticado)
    const auth = requireSession(request);
    if (!auth.authorized) {
      return NextResponse.json(auth.response, { status: auth.status });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'El cuerpo de la solicitud no puede estar vacío.' }, { status: 400 });
    }

    const { notes, items } = body;

    // 1. Validar estructura de items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'El campo "items" es obligatorio y debe ser un arreglo con al menos un elemento.' },
        { status: 422 }
      );
    }

    // 2. Leer la base de datos
    const db = await readDB();
    const orderItems: OrderItem[] = [];
    let calculatedTotal = 0;

    // Clonamos los suplementos para validar el stock simulando la compra antes de persistir
    const tempSupplements = JSON.parse(JSON.stringify(db.supplements));
    const validationErrors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { supplementId, quantity } = item;

      if (typeof supplementId !== 'string' || !supplementId.trim()) {
        validationErrors.push(`Ítem en el índice ${i}: 'supplementId' es requerido y debe ser una cadena.`);
        continue;
      }

      if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
        validationErrors.push(`Ítem en el índice ${i}: 'quantity' debe ser un número entero mayor a cero.`);
        continue;
      }

      // Buscar el suplemento en la base de datos temporal
      const supplementIndex = tempSupplements.findIndex((s: any) => s.id === supplementId);
      if (supplementIndex === -1) {
        validationErrors.push(`Ítem en el índice ${i}: El suplemento con ID '${supplementId}' no existe.`);
        continue;
      }

      const supplement = tempSupplements[supplementIndex];

      // Validar si requiere receta (opcional: solo informativo o validación adicional)
      // En este caso, simplemente registramos el ítem, pero validamos el stock
      if (supplement.stock < quantity) {
        validationErrors.push(
          `Ítem en el índice ${i}: Stock insuficiente para '${supplement.name}'. Solicitado: ${quantity}, Disponible: ${supplement.stock}.`
        );
        continue;
      }

      // Restar el stock temporalmente
      supplement.stock -= quantity;

      // Calcular subtotal e ir armando el OrderItem
      const priceAtOrder = supplement.price;
      calculatedTotal += priceAtOrder * quantity;

      orderItems.push({
        id: crypto.randomUUID(),
        supplementId,
        quantity,
        priceAtOrder,
      });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ error: 'Errores de validación en los ítems.', details: validationErrors }, { status: 422 });
    }

    // 3. Aplicar los cambios de stock reales en la BD
    db.supplements = tempSupplements;

    // 4. Crear el pedido
    const newOrder: Order = {
      id: crypto.randomUUID(),
      customerId: auth.session.userId,
      status: 'pending',
      notes: typeof notes === 'string' ? notes.trim() : undefined,
      items: orderItems,
      total: parseFloat(calculatedTotal.toFixed(2)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.orders.push(newOrder);
    await writeDB(db);

    return NextResponse.json(newOrder, { status: 201 });
  } catch (error) {
    console.error('Error al crear pedido:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
