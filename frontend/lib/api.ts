const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (typeof window === "undefined" ? "http://127.0.0.1:8000" : "");

function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("vaada_csrf="));
  return match ? decodeURIComponent(match.split("=")[1]) : undefined;
}

export async function apiFetch(path: string, init: RequestInit = {}, isRetry: boolean = false): Promise<any> {
  const csrf = getCsrfToken();
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  // Handle 401 session expiration with silent refresh
  if (response.status === 401 && !isRetry) {
    const isAuthRoute =
      path.includes("/auth/login") ||
      path.includes("/auth/refresh") ||
      path.includes("/auth/signup") ||
      path.includes("/auth/forgot-password");

    if (!isAuthRoute) {
      try {
        const refreshCsrf = getCsrfToken();
        const refreshRes = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(refreshCsrf ? { "X-CSRF-Token": refreshCsrf } : {}),
          },
        });

        if (refreshRes.ok) {
          // Token refreshed successfully, retry original request once
          return apiFetch(path, init, true);
        }
      } catch {
        // Refresh failed, proceed to error handling
      }

      // If refresh failed and we are client-side on a protected route, redirect cleanly
      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith("/login") && !currentPath.startsWith("/portal")) {
          const next = encodeURIComponent(currentPath + window.location.search);
          window.location.href = `/login?next=${next}`;
        }
      }
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
  }

  // Handle empty bodies (e.g. 204 No Content) or non-json
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}
