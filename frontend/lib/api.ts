const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const csrf = typeof document === "undefined" ? "" : document.cookie
    .split("; ")
    .find((row) => row.startsWith("vaayda_csrf="))
    ?.split("=")[1];
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
  }
  return response.json();
}
