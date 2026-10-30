// Small fetch wrapper. A stale/invalid token on any call logs the user out cleanly.
export async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Token " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && /token/i.test(data.detail || "")) window.dispatchEvent(new Event("sp:logout"));
    const e = new Error(data.error || data.detail || "Something went wrong. Please try again.");
    e.status = res.status;
    throw e;
  }
  return data;
}
