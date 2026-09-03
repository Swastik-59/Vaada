---
title: Deduplicate Global Event Listeners
impact: LOW
impactDescription: single listener for N components
tags: client, event-listeners, subscription
---

## Deduplicate Global Event Listeners

Share global event listeners across component instances instead of registering
one listener per hook instance.

**Incorrect (N instances = N listeners):**

```tsx
function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === key) {
        callback();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback]);
}
```

When using the `useKeyboardShortcut` hook multiple times, each instance will register a new listener.

**Correct (N instances = 1 listener):**

```tsx
let listening = false;
let subscribers = 0;
const keyCallbacks = new Map<string, Set<() => void>>();

function useKeyboardShortcut(key: string, callback: () => void) {
  // Register this callback in the Map
  useEffect(() => {
    if (!keyCallbacks.has(key)) {
      keyCallbacks.set(key, new Set());
    }
    keyCallbacks.get(key)!.add(callback);

    return () => {
      const set = keyCallbacks.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          keyCallbacks.delete(key);
        }
      }
    };
  }, [key, callback]);

  useEffect(() => {
    subscribers += 1;

    if (!listening) {
      const handler = (e: KeyboardEvent) => {
        if (e.metaKey && keyCallbacks.has(e.key)) {
          keyCallbacks.get(e.key)!.forEach((cb) => cb());
        }
      };
      window.addEventListener("keydown", handler);
      listening = true;

      return () => {
        subscribers -= 1;
        if (subscribers === 0) {
          window.removeEventListener("keydown", handler);
          listening = false;
        }
      };
    }

    return () => {
      subscribers -= 1;
    };
  }, []);
}

function Profile() {
  // Multiple shortcuts will share the same listener
  useKeyboardShortcut("p", () => {
    /* ... */
  });
  useKeyboardShortcut("k", () => {
    /* ... */
  });
  // ...
}
```
