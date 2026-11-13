// Thin fetch wrapper. Session lives in an httpOnly cookie (with an in-memory
// Bearer fallback for browsers that block cross-origin cookies between separate
// Vercel deployments). The custom header is part of our CSRF defence.
const rawBase = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const API_BASE = rawBase.endsWith("/api") ? rawBase.slice(0, -4) : rawBase;

let memoryToken = null;

export function setSessionToken(token) {
  memoryToken = token || null;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, body) {
  const res = await fetch(`${API_BASE}/api${url}`, {
    method,
    credentials: API_BASE ? "include" : "same-origin",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  return data;
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body = {}) => request("POST", url, body),
  put: (url, body = {}) => request("PUT", url, body),
  del: (url) => request("DELETE", url),
};


