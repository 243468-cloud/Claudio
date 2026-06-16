import { promises as fs } from 'node:fs';
import path from 'node:path';

// Interfaces del sistema
export interface Supplement {
  id: string;
  name: string;
  brand: string;
  category: string;
  presentation: string;
  dosage: string;
  price: number;
  stock: number;
  requiresPrescription: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  supplementId: string;
  quantity: number;
  priceAtOrder: number;
}

export interface Order {
  id: string;
  customerId: string;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseSchema {
  supplements: Supplement[];
  orders: Order[];
}

// Ruta absoluta hacia el archivo db.json en la raíz del proyecto
const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

/**
 * Lee el archivo JSON de la base de datos de manera asíncrona.
 * Si el archivo no existe, lo inicializa con un esquema vacío.
 */
export async function readDB(): Promise<DatabaseSchema> {
  try {
    const fileContent = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(fileContent) as DatabaseSchema;
  } catch (error: any) {
    // Si el archivo no existe o está dañado, retornamos una estructura base limpia
    if (error.code === 'ENOENT') {
      const defaultSchema: DatabaseSchema = { supplements: [], orders: [] };
      await writeDB(defaultSchema);
      return defaultSchema;
    }
    throw error;
  }
}

/**
 * Escribe el esquema de la base de datos al archivo JSON de manera segura.
 */
export async function writeDB(data: DatabaseSchema): Promise<void> {
  // Nos aseguramos de que el directorio padre exista
  const dir = path.dirname(DB_PATH);
  await fs.mkdir(dir, { recursive: true });
  
  // Guardamos con espaciado legible para depuración sencilla
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}
