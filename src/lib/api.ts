let csrfToken: string | null = null;

export async function fetchCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/csrf-token");
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
      if (typeof window !== "undefined") {
        (window as any).__csrfToken = csrfToken;
      }
      return csrfToken;
    }
  } catch (err) {
    console.error("Failed to fetch CSRF token:", err);
  }
  return null;
}

export function getCsrfToken(): string | null {
  return csrfToken || (typeof window !== "undefined" ? (window as any).__csrfToken : null);
}

export function setCsrfToken(token: string | null) {
  csrfToken = token;
  if (typeof window !== "undefined") {
    (window as any).__csrfToken = token;
  }
}

// Global fetch patcher to intercept all write operations on /api and inject CSRF header
export function setupCsrfInterceptor() {
  if (typeof window === "undefined") return;
  if ((window as any).__csrfInterceptorSetup) return;

  (window as any).__csrfInterceptorSetup = true;
  const originalFetch = window.fetch;
  
  const customFetch = async function (this: any, input: RequestInfo | URL, init?: RequestInit) {
    const urlStr = typeof input === "string" 
      ? input 
      : input instanceof URL 
        ? input.toString() 
        : input.url;
    
    // Check if it's an API request and not a safe method (GET, HEAD, OPTIONS)
    const isApi = urlStr.includes("/api/");
    const method = init?.method?.toUpperCase() || "GET";
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

    if (isApi && isWrite) {
      const token = getCsrfToken();
      if (token) {
        init = init || {};
        const headers = { ...init.headers } as Record<string, string>;
        // Case-insensitive check
        const hasCsrf = Object.keys(headers).some(k => k.toLowerCase() === "x-csrf-token");
        if (!hasCsrf) {
          headers["X-CSRF-Token"] = token;
          init.headers = headers;
        }
      }
    }
    return originalFetch.call(this, input, init);
  };

  try {
    Object.defineProperty(window, "fetch", {
      value: customFetch,
      configurable: true,
      writable: true,
      enumerable: true
    });
  } catch (err) {
    console.warn("Could not patch window.fetch via Object.defineProperty, trying direct assignment:", err);
    try {
      (window as any).fetch = customFetch;
    } catch (assignErr) {
      console.error("Failed to patch window.fetch completely:", assignErr);
    }
  }
}
