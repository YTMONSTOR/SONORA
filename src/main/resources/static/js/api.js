// REST client with Spring Security CSRF support (XSRF-TOKEN cookie → X-XSRF-TOKEN header).
export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function request(method, url, body, { form = false } = {}) {
  const headers = { Accept: "application/json" };
  const token = csrf();
  if (method !== "GET" && token) headers["X-XSRF-TOKEN"] = token;
  let payload;
  if (body !== undefined) {
    if (form) payload = body;
    else { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError("Can't reach SONORA. Check your connection and try again.", 0);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const msg = data?.error || (res.status === 401 ? "Sign in to continue" : res.status === 403 ? "You don't have access to this" : `Request failed (${res.status})`);
    throw new ApiError(msg, res.status);
  }
  return data;
}

export const api = {
  get: (u) => request("GET", u),
  post: (u, b) => request("POST", u, b ?? {}),
  put: (u, b) => request("PUT", u, b ?? {}),
  patch: (u, b) => request("PATCH", u, b ?? {}),
  del: (u) => request("DELETE", u),
  upload: (u, formData) => request("POST", u, formData, { form: true }),
};
