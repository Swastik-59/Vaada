---
title: Start Dependent Work As Early As Possible
impact: CRITICAL
impactDescription: 2-10× improvement
tags: async, parallelization, dependencies
---

## Start Dependent Work As Early As Possible

For operations with partial dependencies, create promises as soon as each
dependency is available so unrelated work can continue in parallel.

**Incorrect (profile waits for config unnecessarily):**

```typescript
const [user, config] = await Promise.all([fetchUser(), fetchConfig()]);
const profile = await fetchProfile(user.id);
```

**Correct (config and profile run in parallel):**

```typescript
const userPromise = fetchUser();
const profilePromise = userPromise.then((user) => fetchProfile(user.id));

const [user, config, profile] = await Promise.all([
  userPromise,
  fetchConfig(),
  profilePromise,
]);
```

The important part is not the helper library. The important part is starting
dependent work the moment its input becomes available.
