import { NextRequest } from 'next/server';

export interface UserSession {
  userId: string;
  role: 'admin' | 'customer';
}

/**
 * Extrae y valida la sesión de usuario a partir de la cabecera 'Authorization'.
 * Espera el formato: "Bearer <rol>-<id_de_usuario>"
 * Ejemplo: "Bearer admin-123" o "Bearer customer-456"
 * 
 * Si no está presente o el formato es incorrecto, retorna null.
 */
export function getSession(request: NextRequest): UserSession | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return null;
  }

  // Esperamos el formato 'Bearer <token>'
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  const token = parts[1];
  // El token debe tener el formato: rol-userId (ej. admin-1, customer-uuid)
  const tokenParts = token.split('-');
  if (tokenParts.length < 2) {
    return null;
  }

  const role = tokenParts[0];
  const userId = tokenParts.slice(1).join('-'); // Reensamblamos en caso de que el userId contenga guiones

  if (role !== 'admin' && role !== 'customer') {
    return null;
  }

  return {
    userId,
    role: role as 'admin' | 'customer'
  };
}

/**
 * Valida si la sesión es válida y opcionalmente restringe por rol.
 * Retorna un objeto con la sesión si es válida, o lanza un error estructurado para la respuesta.
 */
export function requireSession(request: NextRequest, allowedRole?: 'admin' | 'customer') {
  const session = getSession(request);
  if (!session) {
    return {
      authorized: false as const,
      status: 401,
      response: { error: 'No autorizado. Se requiere un token Bearer válido.' }
    };
  }

  if (allowedRole && session.role !== allowedRole) {
    return {
      authorized: false as const,
      status: 403,
      response: { error: 'Acceso prohibido. Permisos insuficientes.' }
    };
  }

  return {
    authorized: true as const,
    session
  };
}
