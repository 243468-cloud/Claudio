import { NextRequest, NextResponse } from 'next/server';
import { readDB } from '@/lib/db';
import { requireSession } from '@/lib/auth';

/**
 * GET /api/v1/orders/me
 * Retorna los pedidos pertenecientes al usuario autenticado.
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación (Cualquier usuario autenticado)
    const auth = requireSession(request);
    if (!auth.authorized) {
      return NextResponse.json(auth.response, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const pageStr = searchParams.get('page') || '1';
    const limitStr = searchParams.get('limit') || '10';
    const status = searchParams.get('status')?.toLowerCase();

    const page = parseInt(pageStr, 10);
    const limit = parseInt(limitStr, 10);

    if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
      return NextResponse.json(
        { error: 'Los parámetros de paginación (page, limit) deben ser números enteros positivos.' },
        { status: 400 }
      );
    }

    const db = await readDB();
    
    // Filtrar solo los pedidos que pertenecen al usuario autenticado actual
    let myOrders = db.orders.filter((o) => o.customerId === auth.session.userId);

    // Aplicar filtro por estado si se especifica
    if (status) {
      myOrders = myOrders.filter((o) => o.status === status);
    }

    // Paginación
    const totalItems = myOrders.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = myOrders.slice(startIndex, startIndex + limit);

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
    console.error('Error al listar mis pedidos:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
