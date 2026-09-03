---
title: useEffect Only For External Systems
impact: CRITICAL
impactDescription: prevents effect-driven control flow, redundant renders, and state drift
tags: rerender, useEffect, external-systems, derived-state, events
---

## useEffect Only For External Systems

Treat `useEffect` as a synchronization escape hatch. Reach for it only when
React must connect to something outside React, such as subscriptions, timers,
DOM APIs, browser APIs, sockets, or third-party widgets.

Do not use an effect to:

- copy props into state
- derive one React value from other React values
- run logic caused by a user action
- start routine app data fetching that belongs in a loader, server function, or shared cache
- "keep two pieces of state in sync"

**Incorrect (effect used as React-to-React control flow):**

```tsx
function AppSidebar({ availableIds }: { availableIds: string[] }) {
  const [active, setActive] = useState<string | null>(null);
  const resolved =
    active != null && availableIds.includes(active) ? active : availableIds[0] ?? null;

  useEffect(() => {
    if (resolved !== active) {
      setActive(resolved);
    }
  }, [active, resolved]);

  return <Sidebar active={resolved} />;
}
```

**Correct (derive during render, store only the user preference):**

```tsx
function AppSidebar({ availableIds }: { availableIds: string[] }) {
  const [preferred, setPreferred] = useState<string | null>(null);
  const active =
    preferred != null && availableIds.includes(preferred)
      ? preferred
      : availableIds[0] ?? null;

  return <Sidebar active={active} onSelect={setPreferred} />;
}
```

If you cannot point to the external system being synchronized, the effect is
probably the wrong tool.

References:

- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
