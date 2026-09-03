---
name: react-best-practices
description: >
  React and frontend performance optimization guidelines. Use when writing,
  reviewing, or refactoring React code to improve rendering behavior, bundle
  cost, async concurrency, and browser performance. Treat useEffect as a last
  resort: do not use it for derived state, prop-to-state syncing, user-event
  logic, or data fetching that belongs in loaders, server functions, or shared
  caches.
license: MIT
metadata:
  author: Prisma Labs
  version: "1.0.0"
---

# React Best Practices

Performance and architecture guide for React and frontend applications. This fork keeps the broad upstream performance guidance, but it changes the default stance on `useEffect`: treat it as a synchronization escape hatch, not as a general control-flow tool.

## Default Stance On `useEffect`

- `useEffect` is a last resort.
- Only use an effect when React must synchronize with something outside React: DOM APIs, subscriptions, timers, sockets, third-party widgets, or browser APIs.
- If the code can run during render, in an event handler, in a loader/server function, or via a keyed reset, do that instead.
- Do not add effects just to keep React values in sync with other React values.

## Before You Add An Effect

Ask these questions in order:

1. If this value is derived from props or state, can I calculate it during render?
2. If this work happens because the user clicked, typed, submitted, or toggled something, can I run it directly in the event handler?
3. If local state should reset when identity changes, can I key the subtree or model state by that identity instead of syncing with an effect?
4. If this is app data fetching, should it live in a route loader, server function, or shared cache instead of a component effect?
5. If this is truly synchronizing with an external system, can I keep dependencies narrow and cleanup explicit?

## When to Apply

Reference these guidelines when:

- Writing new React components or SSR-driven pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React code
- Optimizing bundle size or load times

## Rule Categories by Priority

| Priority | Category                  | Impact      | Prefix       |
| -------- | ------------------------- | ----------- | ------------ |
| 1        | Eliminating Waterfalls    | CRITICAL    | `async-`     |
| 2        | Bundle Size Optimization  | CRITICAL    | `bundle-`    |
| 3        | Server-Side Performance   | HIGH        | `server-`    |
| 4        | Client-Side Data Fetching | MEDIUM-HIGH | `client-`    |
| 5        | Re-render Optimization    | MEDIUM      | `rerender-`  |
| 6        | Rendering Performance     | MEDIUM      | `rendering-` |
| 7        | JavaScript Performance    | LOW-MEDIUM  | `js-`        |
| 8        | Advanced Patterns         | LOW         | `advanced-`  |

## Quick Reference

### Hard Gate: Effect Discipline (CRITICAL)

- `rerender-useeffect-external-systems-only` - Use effects only for synchronization with systems outside React
- `rerender-derived-state-no-effect` - Derive values during render instead of mirroring React values through state and effects
- `rerender-move-effect-to-event` - Put user-triggered logic in event handlers instead of state-plus-effect flows
- `rerender-key-reset-over-effect-sync` - Reset state with identity or keys instead of prop-sync effects
- `client-shared-cache-dedup` - Prefer shared caches and non-component data seams over ad hoc effect fetches

### 1. Eliminating Waterfalls (CRITICAL)

- `async-cheap-condition-before-await` - Check cheap sync conditions before awaiting flags or remote values
- `async-defer-await` - Move await into branches where actually used
- `async-parallel` - Use Promise.all() for independent operations
- `async-dependencies` - Start dependent work as early as possible
- `async-api-routes` - Start promises early, await late in API routes
- `async-suspense-boundaries` - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-dynamic-imports` - Lazy-load heavy components and tools
- `bundle-defer-third-party` - Load analytics/logging after hydration
- `bundle-conditional` - Load modules only when feature is activated
- `bundle-preload` - Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)

- `server-cache-react` - Use React.cache() for per-request deduplication
- `server-cache-lru` - Use LRU cache for cross-request caching
- `server-hoist-static-io` - Hoist static I/O (fonts, logos) to module level
- `server-no-shared-module-state` - Avoid module-level mutable request state in SSR
- `server-parallel-fetching` - Restructure components to parallelize fetches
- `server-parallel-nested-fetching` - Chain nested fetches per item in Promise.all

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- `client-shared-cache-dedup` - Use a shared client cache for request deduplication
- `client-event-listeners` - Deduplicate global event listeners
- `client-passive-event-listeners` - Use passive listeners for scroll
- `client-localstorage-schema` - Version and minimize localStorage data

### 5. Re-render Optimization (MEDIUM)

- `rerender-defer-reads` - Don't subscribe to state only used in callbacks
- `rerender-memo` - Extract expensive work into memoized components
- `rerender-memo-with-default-value` - Hoist default non-primitive props
- `rerender-dependencies` - Use primitive dependencies in effects
- `rerender-derived-state` - Subscribe to derived booleans, not raw values
- `rerender-derived-state-no-effect` - Derive state during render, not effects
- `rerender-functional-setstate` - Use functional setState for stable callbacks
- `rerender-lazy-state-init` - Pass function to useState for expensive values
- `rerender-simple-expression-in-memo` - Avoid memo for simple primitives
- `rerender-split-combined-hooks` - Split hooks with independent dependencies
- `rerender-move-effect-to-event` - Put interaction logic in event handlers
- `rerender-transitions` - Use startTransition for non-urgent updates
- `rerender-use-deferred-value` - Defer expensive renders to keep input responsive
- `rerender-use-ref-transient-values` - Use refs for transient frequent values
- `rerender-no-inline-components` - Don't define components inside components

### 6. Rendering Performance (MEDIUM)

- `rendering-animate-svg-wrapper` - Animate div wrapper, not SVG element
- `rendering-content-visibility` - Use content-visibility for long lists
- `rendering-hoist-jsx` - Extract static JSX outside components
- `rendering-svg-precision` - Reduce SVG coordinate precision
- `rendering-hydration-no-flicker` - Use inline script for client-only data
- `rendering-hydration-suppress-warning` - Suppress expected mismatches
- `rendering-conditional-render` - Use ternary, not && for conditionals
- `rendering-usetransition-loading` - Prefer useTransition for loading state
- `rendering-resource-hints` - Use React DOM resource hints for preloading
- `rendering-script-defer-async` - Use defer or async on script tags

### 7. JavaScript Performance (LOW-MEDIUM)

- `js-batch-dom-css` - Group CSS changes via classes or cssText
- `js-index-maps` - Build Map for repeated lookups
- `js-cache-property-access` - Cache object properties in loops
- `js-cache-function-results` - Cache function results in module-level Map
- `js-cache-storage` - Cache localStorage/sessionStorage reads
- `js-combine-iterations` - Combine multiple filter/map into one loop
- `js-length-check-first` - Check array length before expensive comparison
- `js-early-exit` - Return early from functions
- `js-hoist-regexp` - Hoist RegExp creation outside loops
- `js-min-max-loop` - Use loop for min/max instead of sort
- `js-set-map-lookups` - Use Set/Map for O(1) lookups
- `js-tosorted-immutable` - Use toSorted() for immutability
- `js-flatmap-filter` - Use flatMap to map and filter in one pass
- `js-request-idle-callback` - Defer non-critical work to browser idle time

### 8. Advanced Patterns (LOW)

- `advanced-effect-event-deps` - Don't put `useEffectEvent` results in effect deps
- `advanced-event-handler-refs` - Store event handlers in refs
- `advanced-init-once` - Initialize app once per app load
- `advanced-use-latest` - useLatest for stable callback refs

## How to Use

Start with the effect-discipline rules when an implementation is about to add `useEffect`, then read the relevant performance rules for the rest of the change.

Read individual rule files for detailed explanations and code examples:

```
rules/rerender-useeffect-external-systems-only.md
rules/rerender-derived-state-no-effect.md
rules/rerender-key-reset-over-effect-sync.md
```

Each rule file contains:

- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

## Notes

This fork keeps the upstream `AGENTS.md` snapshot for reference, but the local
source of truth is the `SKILL.md` file plus the rule files under `rules/`.
