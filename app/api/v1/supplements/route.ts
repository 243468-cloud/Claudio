import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB, Supplement } from '@/lib/db';

/**
 * GET /api/v1/supplements
 * Retorna la lista de suplementos filtrada y paginada.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Obtener parámetros de consulta
    const pageStr = searchParams.get('page') || '1';
    const limitStr = searchParams.get('limit') || '10';
    const search = searchParams.get('search')?.toLowerCase() || '';
    const category = searchParams.get('category')?.toLowerCase() || '';
    const inStockStr = searchParams.get('inStock');

    const page = parseInt(pageStr, 10);
    const limit = parseInt(limitStr, 10);

    // Validar que los parámetros de paginación sean correctos
    if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
      return NextResponse.json(
        { error: 'Los parámetros de paginación (page, limit) deben ser números enteros positivos.' },
        { status: 400 }
      );
    }

    const db = await readDB();
    let filtered = [...db.supplements];

    // Aplicar filtros
    if (search) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.brand.toLowerCase().includes(search)
      );
    }

    if (category) {
      filtered = filtered.filter((item) => item.category.toLowerCase() === category);
    }

    if (inStockStr !== null) {
      const inStock = inStockStr === 'true';
      if (inStock) {
        filtered = filtered.filter((item) => item.stock > 0);
      } else {
        filtered = filtered.filter((item) => item.stock === 0);
      }
    }

    // Paginación
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = filtered.slice(startIndex, startIndex + limit);

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
    console.error('Error al listar suplementos:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

/**
 * POST /api/v1/supplements
 * Crea un nuevo suplemento.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'El cuerpo de la solicitud no puede estar vacío.' }, { status: 400 });
    }

    const {
      name,
      brand,
      category,
      presentation,
      dosage,
      price,
      stock,
      requiresPrescription,
      description,
    } = body;

    // 1. Validar campos requeridos y tipos (422 Unprocessable Entity)
    const errors: string[] = [];
    if (typeof name !== 'string' || !name.trim()) errors.push("El campo 'name' es requerido y debe ser texto.");
    if (typeof brand !== 'string' || !brand.trim()) errors.push("El campo 'brand' es requerido y debe ser texto.");
    if (typeof category !== 'string' || !category.trim()) errors.push("El campo 'category' es requerido y debe ser texto.");
    if (typeof presentation !== 'string' || !presentation.trim()) errors.push("El campo 'presentation' es requerido y debe ser texto.");
    if (typeof dosage !== 'string' || !dosage.trim()) errors.push("El campo 'dosage' es requerido y debe ser texto.");
    if (typeof price !== 'number' || price < 0) errors.push("El campo 'price' es requerido y debe ser un número mayor o igual a cero.");
    if (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock)) errors.push("El campo 'stock' es requerido y debe ser un número entero mayor o igual a cero.");
    
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Errores de validación.', details: errors }, { status: 422 });
    }

    const db = await readDB();

    // 2. Comprobar conflicto (409 Conflict) si ya existe un suplemento con el mismo nombre
    const nameExists = db.supplements.some(
      (item) => item.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (nameExists) {
      return NextResponse.json(
        { error: `Ya existe un suplemento registrado con el nombre: '${name}'` },
        { status: 409 }
      );
    }

    // 3. Crear el nuevo suplemento
    const newSupplement: Supplement = {
      id: crypto.randomUUID(),
      name: name.trim(),
      brand: brand.trim(),
      category: category.trim(),
      presentation: presentation.trim(),
      dosage: dosage.trim(),
      price,
      stock,
      requiresPrescription: typeof requiresPrescription === 'boolean' ? requiresPrescription : false,
      description: typeof description === 'string' ? description.trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.supplements.push(newSupplement);
    await writeDB(db);

    return NextResponse.json(newSupplement, { status: 201 });
  } catch (error) {
    console.error('Error al crear suplemento:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
