import { readDB, writeDB, DatabaseSchema } from '../lib/db';
import * as supplementsCollection from '../app/api/v1/supplements/route';
import * as supplementsMember from '../app/api/v1/supplements/[id]/route';
import * as ordersCollection from '../app/api/v1/orders/route';
import * as ordersMe from '../app/api/v1/orders/me/route';
import * as ordersMember from '../app/api/v1/orders/[id]/route';
import * as ordersCancel from '../app/api/v1/orders/[id]/cancel/route';
import * as orderItemsCollection from '../app/api/v1/orders/[id]/items/route';
import * as orderItemsMember from '../app/api/v1/orders/[id]/items/[itemId]/route';
import { NextRequest } from 'next/server';

// Función auxiliar para simular NextRequest
function mockRequest(url: string, method: string, body?: any, headers?: Record<string, string>): NextRequest {
  const init: RequestInit = {
    method,
    headers: new Headers(headers || {}),
  };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Headers).set('Content-Type', 'application/json');
  }
  return new NextRequest(new URL(url), init);
}

// Datos iniciales de prueba para resetear la BD antes de cada test
const initialTestData: DatabaseSchema = {
  supplements: [
    {
      id: 'c0a80101-1111-4444-8888-999999999999',
      name: 'Proteína Whey Premium',
      brand: 'Optimum Nutrition',
      category: 'Proteínas',
      presentation: 'Polvo 2kg',
      price: 800,
      stock: 10,
      dosage: '1 scoop',
      requiresPrescription: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'c0a80101-2222-4444-8888-999999999999',
      name: 'Creatina',
      brand: 'Birdman',
      category: 'Aminoácidos',
      presentation: 'Polvo 500g',
      price: 400,
      stock: 5,
      dosage: '5g',
      requiresPrescription: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  orders: []
};

async function runTests() {
  console.log('=== INICIANDO PRUEBAS DE API ===\n');

  // Resetear DB
  await writeDB(initialTestData);
  console.log('✔ Base de datos inicializada.');

  // -------------------------------------------------------------
  // Test 1: GET /api/v1/supplements (Listar)
  // -------------------------------------------------------------
  {
    const req = mockRequest('http://localhost:3000/api/v1/supplements?page=1&limit=10', 'GET');
    const res = await supplementsCollection.GET(req);
    const json = await res.json();
    if (res.status === 200 && json.data.length === 2) {
      console.log('✔ GET /api/v1/supplements: OK');
    } else {
      console.error('❌ GET /api/v1/supplements falló', json);
    }
  }

  // -------------------------------------------------------------
  // Test 2: POST /api/v1/supplements (Crear)
  // -------------------------------------------------------------
  let newSupplementId = '';
  {
    const payload = {
      name: 'Glutamina',
      brand: 'Dymatize',
      category: 'Recuperación',
      presentation: 'Polvo 300g',
      dosage: '5g',
      price: 300,
      stock: 12,
      requiresPrescription: false
    };
    const req = mockRequest('http://localhost:3000/api/v1/supplements', 'POST', payload);
    const res = await supplementsCollection.POST(req);
    const json = await res.json();
    if (res.status === 201 && json.id) {
      newSupplementId = json.id;
      console.log(`✔ POST /api/v1/supplements: OK (Creado con ID: ${newSupplementId})`);
    } else {
      console.error('❌ POST /api/v1/supplements falló', json);
    }
  }

  // -------------------------------------------------------------
  // Test 3: GET /api/v1/supplements/[id] (Detalle)
  // -------------------------------------------------------------
  {
    const req = mockRequest(`http://localhost:3000/api/v1/supplements/${newSupplementId}`, 'GET');
    const res = await supplementsMember.GET(req, { params: Promise.resolve({ id: newSupplementId }) });
    const json = await res.json();
    if (res.status === 200 && json.name === 'Glutamina') {
      console.log('✔ GET /api/v1/supplements/[id]: OK');
    } else {
      console.error('❌ GET /api/v1/supplements/[id] falló', json);
    }
  }

  // -------------------------------------------------------------
  // Test 4: PATCH /api/v1/supplements/[id] (Actualizar)
  // -------------------------------------------------------------
  {
    const payload = { price: 350, stock: 20 };
    const req = mockRequest(`http://localhost:3000/api/v1/supplements/${newSupplementId}`, 'PATCH', payload);
    const res = await supplementsMember.PATCH(req, { params: Promise.resolve({ id: newSupplementId }) });
    const json = await res.json();
    if (res.status === 200 && json.price === 350 && json.stock === 20) {
      console.log('✔ PATCH /api/v1/supplements/[id]: OK');
    } else {
      console.error('❌ PATCH /api/v1/supplements/[id] falló', json);
    }
  }

  // -------------------------------------------------------------
  // Test 5: POST /api/v1/orders (Crear Pedido) - Auth Requered
  // -------------------------------------------------------------
  let orderId = '';
  {
    // Intentar sin auth (debe retornar 401)
    const payload = {
      items: [{ supplementId: 'c0a80101-1111-4444-8888-999999999999', quantity: 2 }]
    };
    const reqNoAuth = mockRequest('http://localhost:3000/api/v1/orders', 'POST', payload);
    const resNoAuth = await ordersCollection.POST(reqNoAuth);
    
    // Con auth (debe retornar 201)
    const reqAuth = mockRequest('http://localhost:3000/api/v1/orders', 'POST', payload, {
      'Authorization': 'Bearer customer-testuser1'
    });
    const resAuth = await ordersCollection.POST(reqAuth);
    const jsonAuth = await resAuth.json();

    if (resNoAuth.status === 401 && resAuth.status === 201 && jsonAuth.id) {
      orderId = jsonAuth.id;
      // Verificar decremento de stock: Whey de 10 a 8
      const db = await readDB();
      const whey = db.supplements.find(s => s.id === 'c0a80101-1111-4444-8888-999999999999');
      if (whey && whey.stock === 8) {
        console.log(`✔ POST /api/v1/orders: OK (Creado con ID: ${orderId} y stock descontado)`);
      } else {
        console.error('❌ POST /api/v1/orders: falló la validación del descuento de stock');
      }
    } else {
      console.error('❌ POST /api/v1/orders falló', { noAuthStatus: resNoAuth.status, authStatus: resAuth.status });
    }
  }

  // -------------------------------------------------------------
  // Test 6: GET /api/v1/orders/me (Mis Pedidos)
  // -------------------------------------------------------------
  {
    const req = mockRequest('http://localhost:3000/api/v1/orders/me', 'GET', undefined, {
      'Authorization': 'Bearer customer-testuser1'
    });
    const res = await ordersMe.GET(req);
    const json = await res.json();
    if (res.status === 200 && json.data.length === 1) {
      console.log('✔ GET /api/v1/orders/me: OK');
    } else {
      console.error('❌ GET /api/v1/orders/me falló', json);
    }
  }

  // -------------------------------------------------------------
  // Test 7: GET /api/v1/orders (Listar Admin) - Auth Forbidden check
  // -------------------------------------------------------------
  {
    // Cliente intentando ver todos (403)
    const reqCustomer = mockRequest('http://localhost:3000/api/v1/orders', 'GET', undefined, {
      'Authorization': 'Bearer customer-testuser1'
    });
    const resCustomer = await ordersCollection.GET(reqCustomer);

    // Admin intentando ver todos (200)
    const reqAdmin = mockRequest('http://localhost:3000/api/v1/orders', 'GET', undefined, {
      'Authorization': 'Bearer admin-superadmin'
    });
    const resAdmin = await ordersCollection.GET(reqAdmin);
    
    if (resCustomer.status === 403 && resAdmin.status === 200) {
      console.log('✔ GET /api/v1/orders (Admin & Role Checks): OK');
    } else {
      console.error('❌ GET /api/v1/orders (Admin check) falló', { customerStatus: resCustomer.status, adminStatus: resAdmin.status });
    }
  }

  // -------------------------------------------------------------
  // Test 8: POST /api/v1/orders/[id]/items (Agregar Ítem a pedido)
  // -------------------------------------------------------------
  let orderItemId = '';
  {
    // Agregar Creatina (stock disponible: 5, precio: 400). Cantidad: 1.
    const payload = {
      supplementId: 'c0a80101-2222-4444-8888-999999999999',
      quantity: 1
    };
    const req = mockRequest(`http://localhost:3000/api/v1/orders/${orderId}/items`, 'POST', payload, {
      'Authorization': 'Bearer customer-testuser1'
    });
    const res = await orderItemsCollection.POST(req, { params: Promise.resolve({ id: orderId }) });
    const json = await res.json();

    if (res.status === 201 && json.id) {
      orderItemId = json.id;
      // Verificar recalculación del total: Whey (2 * 800) + Creatina (1 * 400) = 2000
      const db = await readDB();
      const order = db.orders.find(o => o.id === orderId);
      const creatina = db.supplements.find(s => s.id === 'c0a80101-2222-4444-8888-999999999999');
      
      if (order && order.total === 2000 && creatina && creatina.stock === 4) {
        console.log(`✔ POST /api/v1/orders/[id]/items: OK (Total recalculado a 2000, stock reducido)`);
      } else {
        console.error('❌ POST /api/v1/orders/[id]/items: falló verificación de total/stock', { total: order?.total, stock: creatina?.stock });
      }
    } else {
      console.error('❌ POST /api/v1/orders/[id]/items falló', json);
    }
  }

  // -------------------------------------------------------------
  // Test 9: DELETE /api/v1/orders/[id]/items/[itemId] (Eliminar ítem)
  // -------------------------------------------------------------
  {
    const req = mockRequest(`http://localhost:3000/api/v1/orders/${orderId}/items/${orderItemId}`, 'DELETE', undefined, {
      'Authorization': 'Bearer customer-testuser1'
    });
    const res = await orderItemsMember.DELETE(req, { params: Promise.resolve({ id: orderId, itemId: orderItemId }) });

    if (res.status === 204) {
      // Verificar total del pedido: vuelve a 1600 (Whey * 2) y stock de creatina vuelve a 5
      const db = await readDB();
      const order = db.orders.find(o => o.id === orderId);
      const creatina = db.supplements.find(s => s.id === 'c0a80101-2222-4444-8888-999999999999');
      
      if (order && order.total === 1600 && creatina && creatina.stock === 5) {
        console.log(`✔ DELETE /api/v1/orders/[id]/items/[itemId]: OK (Total recalculado a 1600, stock de creatina restaurado)`);
      } else {
        console.error('❌ DELETE /api/v1/orders/[id]/items/[itemId]: falló verificación de restauración', { total: order?.total, stock: creatina?.stock });
      }
    } else {
      console.error('❌ DELETE /api/v1/orders/[id]/items/[itemId] falló con estado', res.status);
    }
  }

  // -------------------------------------------------------------
  // Test 10: POST /api/v1/orders/[id]/cancel (Cancelar pedido)
  // -------------------------------------------------------------
  {
    const req = mockRequest(`http://localhost:3000/api/v1/orders/${orderId}/cancel`, 'POST', undefined, {
      'Authorization': 'Bearer customer-testuser1'
    });
    const res = await ordersCancel.POST(req, { params: Promise.resolve({ id: orderId }) });
    const json = await res.json();

    if (res.status === 200 && json.order.status === 'cancelled') {
      // Verificar stock de Whey: debe haber vuelto a 10 (inicial)
      const db = await readDB();
      const whey = db.supplements.find(s => s.id === 'c0a80101-1111-4444-8888-999999999999');
      
      if (whey && whey.stock === 10) {
        console.log('✔ POST /api/v1/orders/[id]/cancel: OK (Pedido cancelado y stock de Whey restaurado)');
      } else {
        console.error('❌ POST /api/v1/orders/[id]/cancel: falló verificación de restauración de stock de Whey', whey);
      }
    } else {
      console.error('❌ POST /api/v1/orders/[id]/cancel falló', json);
    }
  }

  // -------------------------------------------------------------
  // Test 11: DELETE /api/v1/supplements/[id] (Eliminar Suplemento)
  // -------------------------------------------------------------
  {
    const req = mockRequest(`http://localhost:3000/api/v1/supplements/${newSupplementId}`, 'DELETE');
    const res = await supplementsMember.DELETE(req, { params: Promise.resolve({ id: newSupplementId }) });
    
    if (res.status === 204) {
      const db = await readDB();
      const exists = db.supplements.some(s => s.id === newSupplementId);
      if (!exists) {
        console.log('✔ DELETE /api/v1/supplements/[id]: OK (Eliminado de la BD)');
      } else {
        console.error('❌ DELETE /api/v1/supplements/[id]: falló, sigue existiendo en BD');
      }
    } else {
      console.error('❌ DELETE /api/v1/supplements/[id] falló con estado', res.status);
    }
  }

  console.log('\n=== PRUEBAS DE API FINALIZADAS ===');
}

runTests().catch(err => {
  console.error('Error durante la ejecución del test suite:', err);
});
