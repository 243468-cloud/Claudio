import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB, Supplement } from '@/lib/db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v1/supplements/[id]
 * Obtiene el detalle de un suplemento por su ID.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const db = await readDB();

    const supplement = db.supplements.find((item) => item.id === id);
    if (!supplement) {
      return NextResponse.json({ error: 'Suplemento no encontrado.' }, { status: 404 });
    }

    return NextResponse.json(supplement);
  } catch (error) {
    console.error('Error al obtener suplemento:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/supplements/[id]
 * Actualiza parcialmente un suplemento por su ID.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'El cuerpo de la solicitud no puede estar vacío.' }, { status: 400 });
    }

    const db = await readDB();
    const index = db.supplements.findIndex((item) => item.id === id);
    
    if (index === -1) {
      return NextResponse.json({ error: 'Suplemento no encontrado.' }, { status: 404 });
    }

    const currentSupplement = db.supplements[index];
    const errors: string[] = [];

    // Validaciones de tipos si los campos están presentes
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        errors.push("El campo 'name' debe ser una cadena de texto no vacía.");
      } else {
        // Comprobar conflicto si se cambia el nombre por uno ya existente
        const duplicate = db.supplements.some(
          (item) => item.id !== id && item.name.trim().toLowerCase() === body.name.trim().toLowerCase()
        );
        if (duplicate) {
          return NextResponse.json(
            { error: `Ya existe otro suplemento registrado con el nombre: '${body.name}'` },
            { status: 409 }
          );
        }
      }
    }

    if (body.brand !== undefined && (typeof body.brand !== 'string' || !body.brand.trim())) {
      errors.push("El campo 'brand' debe ser una cadena de texto no vacía.");
    }
    if (body.category !== undefined && (typeof body.category !== 'string' || !body.category.trim())) {
      errors.push("El campo 'category' debe ser una cadena de texto no vacía.");
    }
    if (body.presentation !== undefined && (typeof body.presentation !== 'string' || !body.presentation.trim())) {
      errors.push("El campo 'presentation' debe ser una cadena de texto no vacía.");
    }
    if (body.dosage !== undefined && (typeof body.dosage !== 'string' || !body.dosage.trim())) {
      errors.push("El campo 'dosage' debe ser una cadena de texto no vacía.");
    }
    if (body.price !== undefined && (typeof body.price !== 'number' || body.price < 0)) {
      errors.push("El campo 'price' debe ser un número mayor o igual a cero.");
    }
    if (body.stock !== undefined && (typeof body.stock !== 'number' || body.stock < 0 || !Number.isInteger(body.stock))) {
      errors.push("El campo 'stock' debe ser un número entero mayor o igual a cero.");
    }
    if (body.requiresPrescription !== undefined && typeof body.requiresPrescription !== 'boolean') {
      errors.push("El campo 'requiresPrescription' debe ser un booleano.");
    }
    if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
      errors.push("El campo 'description' debe ser una cadena de texto o null.");
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Errores de validación.', details: errors }, { status: 422 });
    }

    // Actualizar campos
    const updatedSupplement: Supplement = {
      ...currentSupplement,
      name: body.name !== undefined ? body.name.trim() : currentSupplement.name,
      brand: body.brand !== undefined ? body.brand.trim() : currentSupplement.brand,
      category: body.category !== undefined ? body.category.trim() : currentSupplement.category,
      presentation: body.presentation !== undefined ? body.presentation.trim() : currentSupplement.presentation,
      dosage: body.dosage !== undefined ? body.dosage.trim() : currentSupplement.dosage,
      price: body.price !== undefined ? body.price : currentSupplement.price,
      stock: body.stock !== undefined ? body.stock : currentSupplement.stock,
      requiresPrescription: body.requiresPrescription !== undefined ? body.requiresPrescription : currentSupplement.requiresPrescription,
      description: body.description !== undefined ? (body.description ? body.description.trim() : undefined) : currentSupplement.description,
      updatedAt: new Date().toISOString(),
    };

    db.supplements[index] = updatedSupplement;
    await writeDB(db);

    return NextResponse.json(updatedSupplement);
  } catch (error) {
    console.error('Error al actualizar suplemento:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/supplements/[id]
 * Elimina un suplemento por su ID.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const db = await readDB();

    const supplementIndex = db.supplements.findIndex((item) => item.id === id);
    if (supplementIndex === -1) {
      return NextResponse.json({ error: 'Suplemento no encontrado.' }, { status: 404 });
    }

    // Comprobar conflicto: ver si está referenciado en algún pedido activo (no cancelado)
    const isReferenced = db.orders.some((order) =>
      order.status !== 'cancelled' && order.items.some((item) => item.supplementId === id)
    );

    if (isReferenced) {
      return NextResponse.json(
        { error: 'No se puede eliminar el suplemento porque está referenciado en uno o más pedidos activos.' },
        { status: 409 }
      );
    }

    db.supplements.splice(supplementIndex, 1);
    await writeDB(db);

    // Retorna 204 No Content
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error al eliminar suplemento:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
