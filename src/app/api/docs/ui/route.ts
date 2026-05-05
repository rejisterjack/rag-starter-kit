/**
 * /api/docs/ui — Swagger UI HTML
 *
 * Serves a self-contained Swagger UI page that loads the OpenAPI spec
 * from /api/docs. No npm dependency (swagger-ui-react) required —
 * uses the official Swagger UI CDN bundle.
 */

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAG Starter Kit — API Explorer</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .swagger-ui .topbar { background: #111; border-bottom: 1px solid #222; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .info .title { color: #fff; }
    .swagger-ui .scheme-container { background: #111; box-shadow: none; border-bottom: 1px solid #222; }
    #swagger-ui { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/docs',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        deepLinking: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        tryItOutEnabled: true,
        requestInterceptor: function(req) {
          // Automatically include cookies for session-based auth
          req.credentials = 'include';
          return req;
        },
      });
    };
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
