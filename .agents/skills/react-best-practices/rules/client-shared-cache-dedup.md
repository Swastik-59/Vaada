---
title: Use A Shared Client Cache For Request Deduplication
impact: MEDIUM-HIGH
impactDescription: automatic deduplication
tags: client, deduplication, data-fetching, cache
---

## Use A Shared Client Cache For Request Deduplication

Use a shared client data layer that deduplicates requests, caches results, and
coordinates revalidation across component instances.

**Incorrect (no deduplication, each instance fetches):**

```tsx
function UserList() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers);
  }, []);
}
```

**Correct (multiple instances share one request):**

```tsx
const usersResource = createResource({
  key: "users",
  load: fetchUsers,
  staleTime: 30_000,
});

function UserList() {
  const users = usersResource.use();
  return <UsersTable users={users} />;
}
```

Choose any client cache that deduplicates by key and coordinates invalidation
centrally. The principle matters more than the specific library.
