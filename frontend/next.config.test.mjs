import assert from "node:assert/strict";
import test from "node:test";

test("proxies API requests to the configured backend origin", async () => {
  process.env.VAADA_API_ORIGIN = "https://api.vaada.example/";
  const { default: config } = await import(`./next.config.ts?test=${Date.now()}`);
  const [rewrite] = await config.rewrites();

  assert.equal(rewrite.destination, "https://api.vaada.example/api/v1/:path*");
});

test("rejects an invalid API origin at configuration time", async () => {
  process.env.VAADA_API_ORIGIN = "not-a-url";
  await assert.rejects(import(`./next.config.ts?invalid=${Date.now()}`), /VAADA_API_ORIGIN/);
});
