---
title: Reset State With Identity, Not Sync Effects
impact: HIGH
impactDescription: avoids prop-sync effects, stale state, and reset races
tags: rerender, state, useEffect, key, identity
---

## Reset State With Identity, Not Sync Effects

When local state should reset because the identity of the thing being edited or
viewed changed, prefer modeling that identity directly or keying the subtree.
Do not watch props in an effect just to call `setState` with a reset value.

**Incorrect (effect resets state after render):**

```tsx
function ProfileEditor({ userId }: { userId: string }) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft("");
  }, [userId]);

  return <Editor value={draft} onChange={setDraft} />;
}
```

**Correct (key the stateful subtree by identity):**

```tsx
function ProfileEditor({ userId }: { userId: string }) {
  return <ProfileEditorInner key={userId} userId={userId} />;
}

function ProfileEditorInner({ userId }: { userId: string }) {
  const [draft, setDraft] = useState("");
  return <Editor value={draft} onChange={setDraft} />;
}
```

If a keyed reset is too coarse, model state by the same identity that drives the
view so the reset happens as part of normal render logic rather than after an
effect pass.

Reference: [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
