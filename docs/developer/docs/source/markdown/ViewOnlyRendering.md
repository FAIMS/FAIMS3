# Form Rendering System Documentation

The /app contains a view-only renderer which allows customisation of how to render each field type.

## Source code

See `app/src/gui/rendering` - the source code locations are relative to this and may changes.

```
.
├── engine
│   ├── FormRenderer.tsx
│   └── index.ts
├── fields
│   ├── index.ts
│   ├── register.tsx
│   ├── specialised
│   │   ├── index.ts
│   │   ├── Mapping.tsx
│   │   ├── RelatedRecord.tsx
│   │   ├── TakePhoto.tsx
│   │   └── util.tsx
│   └── wrappers
│       ├── index.ts
│       └── PrimitiveWrappers.tsx
├── index.ts
└── types.ts
```

## Architecture

- **Registry System** (`fields/register.tsx`): Maps `componentNamespace::componentName` → renderer functions
- **Renderer Props**: `{value, config, rendererContext}` - controlled components
- **Context**: Provides viewset/view/field IDs, record metadata, and UI spec
- **Null Handling**: Default empty state unless `bypassNullChecks: true` (e.g., attachments)

## Entry Points

### Adding a New Renderer

1. **Create renderer function** in `/fields/specialised/` or as inline function in `fields/register.tsx`
2. **Add to `FieldRendererList`** in `register.tsx`:

```tsx
{
  componentNamespace: 'faims-custom',
  componentName: 'YourField',
  renderComponent: YourRenderer,
  config: {},
  attributes: {bypassNullChecks: false}, // optional
}
```

3. **Export** from appropriate `index.ts`

### Modifying Existing Renderer

- Locate in `FieldRendererList` or `/fields/specialised/`
- Modify `renderComponent` function
- Registry validates on load

## Key Principles

1. **Validate input rigorously** - Use Zod schemas or type guards (see `RelatedRecord.tsx`)
2. **Handle parse failures gracefully** - Try/catch with fallback displays (see `Mapping.tsx` `extractGeoJSON`)
3. **Check for null/undefined/empty** - Empty strings, `""`, null, undefined all count as empty - these are usually pre-filtered, but this can be configured with bypassNullChecks
4. **Async data requires loading states** - Use `useQuery`/`useQueries` with placeholders (see `TakePhoto.tsx`)
5. **Use wrapper components** - for lower level primitives e.g. strings, numbers, use `TextWrapper`, `ListWrapper` for consistent styling
6. **Provide context in errors** - Show meaningful messages, not raw errors
7. **Debug mode support** - Conditionally render `FieldDebugger` via `config.debugMode`

## Example Implementations

- **Simple**: `StringTypeWrapper` - type check → render text
- **Complex validation**: `RelatedRecordRenderer` - Zod parsing → async loading → nested rendering
- **External library**: `MapRenderer` - parse GeoJSON → OpenLayers integration
- **Async attachments**: `TakePhotoRender` - query chain → base64 display → offline handling

## Common Patterns

```tsx
// Basic structure
export const YourRenderer: RenderFunctionComponent = props => {
  // 1. Validate/parse props.value
  const parsed = validateInput(props.value);
  if (!parsed) return <TextWrapper content="Invalid data" />;

  // 2. Async data if needed
  const {data, isLoading} = useQuery({...});
  if (isLoading) return <LoadingPlaceholder />;

  // 3. Render (trying to keep styling consistent)
  return <div>{data}</div>;
};
```

## Registry Lookup

```tsx
getRendererFromFieldConfig({
  uiSpecification,
  fieldName,
}); // → FieldRendererEntry | undefined
```
