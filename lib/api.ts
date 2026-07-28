export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  // Aquí puedes configurar la URL base de tu API externa.
  // Por ejemplo, si usas variables de entorno: process.env.NEXT_PUBLIC_API_URL
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://jsonplaceholder.typicode.com';

  const defaultHeaders = {
    'Content-Type': 'application/json',
    // 'Authorization': `Bearer ${token}` // Aquí puedes agregar tokens de autenticación
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Error en la petición: ${response.status}`);
  }

  return response.json();
}
