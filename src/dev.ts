import { serveDir } from '@std/http/file-server';

const corsHeaders = ['Access-Control-Allow-Origin: *'];
const configuredPort = Deno.env.get('PORT');
const port = configuredPort === undefined ? 3000 : Number(configuredPort);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new RangeError(`Invalid PORT: ${configuredPort}`);
}

const server = Deno.serve({ hostname: '127.0.0.1', port }, async (request) => {
  if (request.method === 'OPTIONS') {
    const headers = new Headers({ 'Access-Control-Allow-Origin': '*' });
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      request.headers.get('Access-Control-Request-Headers') ?? '*',
    );
    return new Response(null, { status: 204, headers });
  }

  return await serveDir(request, {
    fsRoot: 'public',
    headers: corsHeaders,
  });
});

console.log(`Serving public/ at http://127.0.0.1:${server.addr.port}`);
