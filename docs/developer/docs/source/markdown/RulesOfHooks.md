# React Rules of Hooks (oxlint)

We enforce [`react/rules-of-hooks`](https://oxc.rs/docs/guide/usage/linter/rules/react/rules-of-hooks)
via oxlint. Hooks must be called unconditionally at the top level of React
function components and custom hooks (`use*`), in the same order every render.

## Configuration

In [`.oxlintrc.json`](../../../../../.oxlintrc.json):

- `plugins` lists the **default** plugins (`eslint`, `typescript`, `unicorn`,
  `oxc`) **plus** `react`. Setting `plugins` replaces the default set entirely,
  so the defaults must be restated when adding `react`.
- `react/rules-of-hooks` is `"error"`.
- `react/exhaustive-deps` is `"off"` for now. Enabling the react plugin would
  otherwise warn on many existing dependency arrays; that is a separate cleanup.

## What we fixed

Most violations in legacy code were the same pattern: an early `return` for loading /
unauthenticated UI **before** later hook calls. React treats that as a
conditional hook call.

**Correct pattern:** call every hook first, then branch for UI.

```tsx
// Bad
if (!user) return null;
const data = useGetSomething({user});

// Good
const data = useGetSomething({user}); // hook uses enabled: !!user internally
if (!user) return null;
```

The same idea applies inside custom hooks: put guards **inside** `useMemo` /
effects / query `enabled` flags, not before the hook call.

Other fixes:

- Column-factory hooks (`useGet*Columns`) called auth hooks after `if (!user)
return []` — moved the empty return to after all hooks.
- `invalidateRecordAudit` called `useQueryClient` but was not a hook or
  component. It now takes a `QueryClient` argument from the call site.

## Tricky cases (and how they were handled)

### 1. Compiled UI spec not ready yet (`app` notebook views)

`compiledSpecService.getSpec(...)` can return `undefined` while the notebook
UI spec is still compiling. Several components used:

```tsx
const uiSpec = compiledSpecService.getSpec(id);
if (!uiSpec) return <CircularLoading ... />;
// ... many hooks that need uiSpec
```

That is illegal once rules-of-hooks is on.

**Approach used:**

- Keep all hooks unconditional.
- Pass `enabled: !!uiSpecification` into data hooks (`useRecordList`).
- Allow `uiSpecification` to be `undefined` on those hooks; the query must not
  run (and must not dereference the spec) until it is present.
- For row hydration (`useRowHydration`), accept a nullable spec and schedule
  **no** queries until it exists.
- Render the loading spinner **after** the hooks.

Files: `app/src/gui/components/notebook/index.tsx`,
`app/src/gui/components/notebook/record_table.tsx`,
`app/src/utils/customHooks.tsx` (`useRecordList`).

### 2. Route / project id missing (`NotebookSettings`)

`useParams` can yield a missing `projectId`. Hooks that select from Redux were
after `if (!projectId) return`.

**Approach:** call `useAppDispatch` / `useAppSelector` / `useState`
unconditionally (selector no-ops when `projectId` is missing), then return an
empty fragment if there is no project.

File: `app/src/gui/components/notebook/settings/index.tsx`.

### 3. Why not leave early returns before hooks?

Even when a guard is “always true after the first paint” (e.g. auth already
resolved), React’s rules still require a stable hook order. The linter cannot
prove the early return is invariant, and Hot Reload / future refactors can make
a “safe” early return unsafe. Prefer hooks-first everywhere.

## Adding new code

1. Never call hooks after a conditional `return`, inside loops, or inside nested
   non-hook functions.
2. Prefer `enabled` on React Query hooks over skipping the hook call.
3. Prefer `useMemo(() => { if (!x) return fallback; ... }, [deps])` over
   returning before `useMemo`.
4. Helpers that need a query client should take `QueryClient` as an argument;
   only `use*` functions should call `useQueryClient()`.

## Checking locally

```bash
turbo lint
```

This will lint all packages incl. the Rules of Hooks.
