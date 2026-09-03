---
title: Defer Non-Critical Third-Party Libraries
impact: MEDIUM
impactDescription: loads after hydration
tags: bundle, third-party, analytics, defer
---

## Defer Non-Critical Third-Party Libraries

Analytics, logging, and error tracking don't block user interaction. Load them after hydration.

**Incorrect (blocks initial bundle):**

```tsx
import { AnalyticsWidget } from "./analytics-widget";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <AnalyticsWidget />
      </body>
    </html>
  );
}
```

**Correct (loads after hydration):**

```tsx
import { useEffect, useState } from "react";

function DeferredAnalytics() {
  const [AnalyticsWidget, setAnalyticsWidget] =
    useState<null | React.ComponentType>(null);

  useEffect(() => {
    let cancelled = false;

    import("./analytics-widget").then((mod) => {
      if (!cancelled) {
        setAnalyticsWidget(() => mod.AnalyticsWidget);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return AnalyticsWidget ? <AnalyticsWidget /> : null;
}

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <DeferredAnalytics />
      </body>
    </html>
  );
}
```
