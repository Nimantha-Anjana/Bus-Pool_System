const express = require("express");
const spec = require("../docs/openapi");

const router = express.Router();

// Swagger UI from a pinned CDN build. Helmet's strict CSP is relaxed for THIS router only.
const SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";

router.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' cdn.jsdelivr.net; style-src 'self' cdn.jsdelivr.net 'unsafe-inline'; img-src 'self' data: cdn.jsdelivr.net; connect-src 'self'`
  );
  next();
});

router.get("/openapi.json", (req, res) => res.json(spec));

router.get("/init.js", (req, res) => {
  res.type("application/javascript").send(
    `window.ui = SwaggerUIBundle({ url: "/api/docs/openapi.json", dom_id: "#swagger-ui", persistAuthorization: true, deepLinking: true });`
  );
});

router.get("/", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bus Pool System API</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js"></script>
  <script src="/api/docs/init.js"></script>
</body>
</html>`);
});

module.exports = router;
