interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    throw new ApiError(response.status, body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? "Request failed.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
