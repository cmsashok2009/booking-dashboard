export const runtime = "nodejs";
import { backendUrl } from "../../../../lib/backend-url";

export async function PATCH(request) {
  try {
    const body = await request.json();
    const userId = String(body.userId || "");
    if (!userId) return Response.json({ error: "User id is required." }, { status: 422 });
    const response = await fetch(backendUrl(`api/admin/users/${encodeURIComponent(userId)}`), {
      method: "PATCH",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        cookie: request.headers.get("cookie") || ""
      },
      body: JSON.stringify(body)
    });
    return Response.json(await response.json().catch(() => ({})), { status: response.status });
  } catch (error) {
    return Response.json({ error: error.message || "Unable to update the user." }, { status: 502 });
  }
}
