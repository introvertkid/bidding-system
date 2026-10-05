import { clearSession, getToken } from './session';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // NestJS trả message dạng chuỗi hoặc mảng lỗi validate
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new ApiError(message ?? 'Có lỗi xảy ra, vui lòng thử lại.', response.status);
  }
  return body as T;
}

// Dùng trong Server Component: gọi thẳng backend (trong Docker là http://backend:3000)
export async function serverApi<T>(path: string): Promise<T> {
  const baseUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/v1${path}`, { cache: 'no-store' });
  return parseResponse<T>(response);
}

// Dùng trong Client Component: đi qua proxy /api/v1 của Next.js, tự gắn token đăng nhập
export async function clientApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Không kết nối được máy chủ.', 0);
  }
  // Token hết hạn hoặc user không còn (VD: database vừa reset) -> đăng xuất phiên cũ
  if (response.status === 401 && token) clearSession();
  return parseResponse<T>(response);
}
