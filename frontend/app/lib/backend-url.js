export function backendUrl(pathname) {
  const baseUrl = (process.env.BACKEND_URL || "http://127.0.0.1:5178").replace(/\/$/, "");
  const path = String(pathname || "").replace(/^\/+/, "");
  return `${baseUrl}/${path}`;
}
