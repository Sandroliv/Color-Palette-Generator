export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function handleNotFound() {
  return jsonResponse({ error: "Not Found" }, 404);
}

// Request-Body als JSON lesen. Erfolg → { body }, ungültiges JSON → { error: <400-Response> }.
export async function readJsonBody(req) {
  try {
    return { body: await req.json() };
  } catch {
    return { error: jsonResponse({ error: "Invalid JSON request body" }, 400) };
  }
}
