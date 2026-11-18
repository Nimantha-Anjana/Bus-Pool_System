// Sends server errors (5xx / uncaught) to an optional webhook (Slack, Discord, Teams, any JSON endpoint).
// Set ERROR_WEBHOOK_URL in .env. Failures here are ignored: reporting must never break the API.
const environment = require("../config/environment");

const recent = new Map(); // message -> last sent time (same error at most once per minute)

const reportError = (error, context = "") => {
  const url = environment.errorWebhookUrl;
  if (!url || typeof fetch !== "function") return;

  const message = String(error?.message || error).slice(0, 500);
  const now = Date.now();
  if (now - (recent.get(message) || 0) < 60 * 1000) return;
  recent.set(message, now);
  if (recent.size > 200) recent.clear();

  const text = `Bus Pool API error (${environment.nodeEnv})${context ? ` ${context}` : ""}\n${message}\n${String(error?.stack || "").split("\n").slice(1, 4).join("\n")}`.slice(0, 1800);

  // "text" works for Slack / Teams, "content" for Discord
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, content: text }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
};

module.exports = { reportError };
