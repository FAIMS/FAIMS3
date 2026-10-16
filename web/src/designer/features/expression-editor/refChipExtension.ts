// SPDX-License-Identifier: Apache-2.0
/**
 * @file CodeMirror decorations that replace complete `{ref}` spans with chips.
 *
 * The document stays the raw expression. Only finished `{[^{}]+}` matches
 * become widgets; incomplete `{f_ab` stays text. The same decoration set is
 * provided as `atomicRanges` so backspace/arrows treat a chip as one unit.
 */

import {scanExpressionReferences} from '@faims3/data-model';
import {Compartment, Facet, RangeSetBuilder} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import {
  CHIP_KIND_LABELS,
  type ChipCatalog,
  type ChipModel,
  fallbackChipModel,
} from './chipModel';
import type {RefType} from '@faims3/data-model';

/** CSS class on every chip span (`data-ref` holds the inner id). */
export const EXPR_CHIP_CLASS = 'expr-chip';

/** Max characters shown on a chip face. Longer labels use `...`; hover shows the full text. */
export const CHIP_LABEL_MAX_LENGTH = 30;

/** ASCII ellipsis appended after a truncated face (not `…`). */
const CHIP_LABEL_ELLIPSIS = '...';

/**
 * Truncates a chip face with `...` when it exceeds {@link CHIP_LABEL_MAX_LENGTH}.
 *
 * @param label - Full display label from {@link ChipModel}.
 * @param maxLength - Override for tests; defaults to {@link CHIP_LABEL_MAX_LENGTH}.
 */
export const truncateChipLabel = (
  label: string,
  maxLength: number = CHIP_LABEL_MAX_LENGTH
): string => {
  const chars = Array.from(label);
  if (chars.length <= maxLength) return label;
  return `${chars.slice(0, maxLength).join('')}${CHIP_LABEL_ELLIPSIS}`;
};

/** Suffix after `expr-chip--` for kind colouring. */
const KIND_CLASS: Record<RefType, string> = {
  FIELD: 'field',
  PARENT_FIELD: 'parent',
  RELATED_FIELD: 'related',
  METADATA: 'metadata',
  CONSTANT: 'constant',
  SYSTEM: 'system',
};

/** Catalog used when no facet value is provided. Every `get` falls back. */
const emptyCatalog: ChipCatalog = {
  get: () => undefined,
};

/** Facet carrying the current {@link ChipCatalog}. Last value wins. */
export const chipCatalogFacet = Facet.define<ChipCatalog, ChipCatalog>({
  combine: values =>
    values.length > 0 ? values[values.length - 1] : emptyCatalog,
});

/** Per-editor slot so a label change reconfigures chips without rewriting the doc. */
export const catalogCompartment = new Compartment();

/**
 * Initial catalog extension for `EditorState.create`.
 *
 * @param catalog - Lookup used when decorating the document.
 */
export const catalogOf = (catalog: ChipCatalog) =>
  catalogCompartment.of(chipCatalogFacet.of(catalog));

/**
 * Transaction effect to swap the catalog after a label/field change.
 *
 * @param catalog - Replacement lookup (typically a new `createChipCatalog`).
 */
export const reconfigureCatalog = (catalog: ChipCatalog) =>
  catalogCompartment.reconfigure(chipCatalogFacet.of(catalog));

/** Kind + optional `--error` classes for a chip span. */
const chipClassName = (model: ChipModel): string => {
  const kind = KIND_CLASS[model.kind] ?? 'field';
  return model.error
    ? `${EXPR_CHIP_CLASS} ${EXPR_CHIP_CLASS}--${kind} ${EXPR_CHIP_CLASS}--error`
    : `${EXPR_CHIP_CLASS} ${EXPR_CHIP_CLASS}--${kind}`;
};

/**
 * Inline widget that paints one `{ref}` as a chip.
 * Hover is delegated on the React host; this only sets `data-ref` and aria.
 */
class RefChipWidget extends WidgetType {
  constructor(readonly model: ChipModel) {
    super();
  }

  /** Reuse the DOM node when display-relevant fields are unchanged. */
  override eq(other: RefChipWidget) {
    return (
      other.model.ref === this.model.ref &&
      other.model.label === this.model.label &&
      other.model.kind === this.model.kind &&
      other.model.error === this.model.error
    );
  }

  /** Paint a chip span; `data-ref` is what the React host uses for hover. */
  override toDOM() {
    const el = document.createElement('span');
    el.className = chipClassName(this.model);
    el.textContent = truncateChipLabel(this.model.label);
    el.dataset.ref = this.model.ref;
    el.setAttribute('role', 'img');
    const kindLabel = CHIP_KIND_LABELS[this.model.kind];
    el.setAttribute(
      'aria-label',
      this.model.error
        ? `${kindLabel}: ${this.model.label} (invalid)`
        : `${kindLabel}: ${this.model.label}`
    );
    return el;
  }

  /** Let CodeMirror handle click/selection; do not swallow pointer events. */
  override ignoreEvent() {
    return false;
  }
}

/**
 * Replace-decorations for every complete `{ref}` in the current document.
 *
 * @param view - Editor whose doc and catalog facet are read.
 */
const buildDecorations = (view: EditorView): DecorationSet => {
  const catalog = view.state.facet(chipCatalogFacet);
  const builder = new RangeSetBuilder<Decoration>();
  const source = view.state.doc.toString();
  for (const span of scanExpressionReferences(source)) {
    const model = catalog.get(span.ref) ?? fallbackChipModel(span.ref);
    builder.add(
      span.from,
      span.to,
      Decoration.replace({
        widget: new RefChipWidget(model),
        inclusive: false,
      })
    );
  }
  return builder.finish();
};

/** Holds the chip decoration set and rebuilds it when the document, viewport, or catalog changes. */
class RefChipPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view);
  }

  /** Rebuild when the document, viewport, or catalog facet changes. */
  update(update: ViewUpdate) {
    if (
      update.docChanged ||
      update.viewportChanged ||
      update.startState.facet(chipCatalogFacet) !==
        update.state.facet(chipCatalogFacet)
    ) {
      this.decorations = buildDecorations(update.view);
    }
  }
}

/** ViewPlugin that exposes chip decorations as atomic ranges. */
const refChipViewPlugin = ViewPlugin.fromClass(RefChipPlugin, {
  decorations: value => value.decorations,
  provide: plugin =>
    EditorView.atomicRanges.of(
      view => view.plugin(plugin)?.decorations ?? Decoration.none
    ),
});

/** Chip decorations + atomic ranges so backspace deletes a whole `{ref}`. */
export const refChipExtension = refChipViewPlugin;
