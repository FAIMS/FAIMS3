# CodeMirror + MDXEditor versions

The designer hosts two CodeMirror 6 consumers:

- **ExpressionEditor** (`web/src/designer/features/expression-editor`) —
  computed-field formula chips. Direct deps on `@codemirror/commands`,
  `@codemirror/state`, and `@codemirror/view`.
- **MDXEditor** (`web/src/designer/components/mdx-editor.tsx`) — long-form
  markdown (help text, rich text). Uses CodeMirror only via
  `diffSourcePlugin` (source / diff mode). We do **not** enable
  `sandpackPlugin` or `codeMirrorPlugin`.

## Current compromise (2026-10)

`pnpm-workspace.yaml` forces one copy of the packages ExpressionEditor
imports:

```yaml
overrides:
  '@codemirror/commands': '6.11.1'
  '@codemirror/state': '6.7.6'
  '@codemirror/view': '6.43.13'
```

Those are the latest 6.x releases as of this note, and they satisfy every
declared `^6` range in the tree (MDX 1.14.3, Sandpack, and the
`codemirror` meta-package). After applying the override, `pnpm-lock.yaml`
has one snapshot each of `commands` / `state` / `view`; Sandpack, MDX, and
the `codemirror` meta-package all resolve to those three.

`@mdxeditor/editor` stays on **1.14.3** (`web` specifier `^1.13.5`).
Sandpack is still a hard dependency of that release even though we never
turn it on.

Vite/Vitest CodeMirror aliases, `dedupe`, `optimizeDeps` / `ssr` pinning,
and the ExpressionEditor keymap type-casts were removed after the lockfile
showed one snapshot each.

## Why two trees appeared

Without the override, pnpm resolved two patch-divergent trees:

| Consumer                                   | commands | state | view    |
| ------------------------------------------ | -------- | ----- | ------- |
| ExpressionEditor (direct)                  | 6.11.1   | 6.7.6 | 6.43.13 |
| MDX 1.14.3 + Sandpack + `codemirror@6.0.2` | 6.10.3   | 6.6.0 | 6.43.0  |

The ranges already overlapped. The split was resolution, not an API
mismatch.

## Future: upgrade MDXEditor

Latest `@mdxeditor/editor` is **4.3.4**. That is a product migration, not a
lockfile tidy-up. Do **not** treat it as the way to unify CodeMirror —
keep the overrides until a reinstall proves a single tree.

| MDX           | What changes for us                              |
| ------------- | ------------------------------------------------ |
| 1.14.3 (now)  | Source/diff CM + unused Sandpack CM tree         |
| 3.x (2024)    | Code blocks use vanilla CM; Sandpack still ships |
| 4.0 (2026-05) | Sandpack removed                                 |
| 4.3.4         | Same `^6` CM ranges; Lexical `0.12` → `0.48`     |

4.x still depends on `@codemirror/commands` `^6.2.4`, `state` `^6.4.0`,
`view` `^6.23.0`, `merge`, `lang-markdown`, `language-data`, and the
`codemirror` meta-package. Those ranges accept the overridden versions.
React 18 is still a valid peer (`>= 18` or `>= 19`).

Migration work if we bump 1 → 4:

- Drop leftover `lexical` / `@lexical/react` `^0.12.4` in `web/package.json`
  (nothing in `web/src` imports them; they look like peer satisfaction).
- Revisit the `realmPlugin` / `system` catch-all in `mdx-editor.tsx`.
- Revisit `mdx-editor.css` — image-handle rules are written against v1 DOM.
- Re-test rich-text / help-text editing and source/diff mode.
- After the bump, reinstall and confirm the lockfile still has one CM tree.

`diffSourcePlugin` still exists in 4.x and is the only MDX CodeMirror
surface we use.
