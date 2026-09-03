---
title: Hoist Static I/O to Module Level
impact: HIGH
impactDescription: avoids repeated file/network I/O per request
tags: server, io, performance, route-handlers, assets
---

## Hoist Static I/O to Module Level

**Impact: HIGH (avoids repeated file/network I/O per request)**

When loading static assets (fonts, logos, images, config files) in route handlers or server functions, hoist the I/O operation to module level. Module-level code runs once when the module is first imported, not on every request. This eliminates redundant file system reads or network fetches that would otherwise run on every invocation.

**Incorrect (reads assets on every request):**

```typescript
export async function renderBadge() {
  const fontData = await fetch(
    new URL("./fonts/Inter.ttf", import.meta.url),
  ).then((res) => res.arrayBuffer());
  const logoData = await fetch(
    new URL("./images/logo.png", import.meta.url),
  ).then((res) => res.arrayBuffer());

  return createBadge({ fontData, logoData });
}
```

**Correct (loads once at module initialization):**

```typescript
// Module-level: runs ONCE when module is first imported
const fontData = fetch(new URL("./fonts/Inter.ttf", import.meta.url)).then(
  (res) => res.arrayBuffer(),
);

const logoData = fetch(new URL("./images/logo.png", import.meta.url)).then(
  (res) => res.arrayBuffer(),
);

export async function renderBadge() {
  const [font, logo] = await Promise.all([fontData, logoData]);
  return createBadge({ fontData: font, logoData: logo });
}
```

**Correct (synchronous fs at module level):**

```typescript
import { readFileSync } from "fs";
import { join } from "path";

// Synchronous read at module level - blocks only during module init
const fontData = readFileSync(join(process.cwd(), "public/fonts/Inter.ttf"));

const logoData = readFileSync(join(process.cwd(), "public/images/logo.png"));

export async function renderBadge() {
  return createBadge({ fontData, logoData });
}
```

**Incorrect (reads config on every call):**

```typescript
import fs from "node:fs/promises";

export async function processRequest(data: Data) {
  const config = JSON.parse(await fs.readFile("./config.json", "utf-8"));
  const template = await fs.readFile("./template.html", "utf-8");

  return render(template, data, config);
}
```

**Correct (hoists config and template to module level):**

```typescript
import fs from "node:fs/promises";

const configPromise = fs.readFile("./config.json", "utf-8").then(JSON.parse);
const templatePromise = fs.readFile("./template.html", "utf-8");

export async function processRequest(data: Data) {
  const [config, template] = await Promise.all([
    configPromise,
    templatePromise,
  ]);

  return render(template, data, config);
}
```

When to use this pattern:

- Loading fonts for OG image generation
- Loading static logos, icons, or watermarks
- Reading configuration files that don't change at runtime
- Loading email templates or other static templates
- Any static asset that's the same across all requests

When not to use this pattern:

- Assets that vary per request or user
- Files that may change during runtime (use caching with TTL instead)
- Large files that would consume too much memory if kept loaded
- Sensitive data that shouldn't persist in memory

In long-lived server processes, module-level caching avoids repeated I/O across
requests. In serverless environments, each cold start still pays the initial
cost, but warm invocations benefit until the instance is recycled.
