// SPDX-License-Identifier: Apache-2.0
/**
 * @file CodeMirror host for computed-field expressions: raw `{id}` document,
 * label chips, debounced onChange, and caret insert for pickers.
 */

import {defaultKeymap, history, historyKeymap} from '@codemirror/commands';
import {Compartment, EditorState, Prec, Transaction} from '@codemirror/state';
import {EditorView, keymap} from '@codemirror/view';
import {Box, Paper, Popper} from '@mui/material';
import {alpha, useTheme} from '@mui/material/styles';
import debounce from 'lodash/debounce';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {INPUT_LIMITS} from '../../lib/input-limits';
import {fallbackChipModel, type ChipCatalog, type ChipModel} from './chipModel';
import {expressionEditorTheme} from './expressionEditorTheme';
import {ExprChipTooltip} from './ExprChipTooltip';
import {
  catalogOf,
  EXPR_CHIP_CLASS,
  reconfigureCatalog,
  refChipExtension,
} from './refChipExtension';

/** Matches the designer DebouncedTextField so typing does not flood Redux. */
const DEBOUNCE_MS = 200;
/** Delay before hiding the chip popover so the pointer can enter it. */
const HOVER_CLOSE_MS = 160;

/** Props for {@link ExpressionEditor}. `value` is the stored raw expression. */
export type ExpressionEditorProps = {
  /** Raw expression string (`{f_abc} * 2`). */
  value: string;
  /** Debounced document text after edits or picker insert. */
  onChange: (value: string) => void;
  /** Label / kind lookup; swapped via a CM compartment when fields change. */
  catalog: ChipCatalog;
  /** Outlined error chrome; compile messages stay outside this component. */
  error?: boolean;
  /** When true, the editor is not editable and chips stay visible. */
  disabled?: boolean;
  'data-testid'?: string;
};

/** Imperative API for pickers and tests. */
export type ExpressionEditorHandle = {
  /** Insert `{id}` at the selection (space-prefixed if needed) and focus. */
  insertRef: (id: string) => void;
  /** Focus the CodeMirror content. */
  focus: () => void;
  /** Current document, including un-debounced keystrokes. */
  getValue: () => string;
};

/**
 * Insert `{id}` at the main selection. Prepends a space when the caret sits
 * after a non-whitespace character (same habit as the old append picker).
 */
const insertTokenAtCursor = (view: EditorView, id: string) => {
  const token = `{${id}}`;
  const {from, to} = view.state.selection.main;
  const before = from > 0 ? view.state.doc.sliceString(from - 1, from) : '';
  const insert =
    from === to && from > 0 && !/\s/.test(before) ? ` ${token}` : token;
  view.dispatch({
    changes: {from, to, insert},
    selection: {anchor: from + insert.length},
  });
  view.focus();
};

/**
 * Designer chrome listens for Mod-z / Mod-y on `window`. CodeMirror's
 * {@link historyKeymap} only `preventDefault`s, so the event still bubbles and
 * both stacks undo. Always consume so an empty CM history still does not
 * trigger Redux undo.
 */
const editorHistoryKeymap = historyKeymap.map(binding => ({
  ...binding,
  preventDefault: true,
  stopPropagation: true,
  // `binding.run` is typed against @codemirror/commands' nested view copy.
  run: (...args: Parameters<NonNullable<typeof binding.run>>) => {
    binding.run?.(...args);
    return true;
  },
}));

/** Same keys as the designer window listener in `notebook-editor.tsx`. */
const isDesignerUndoRedoKey = (event: {
  ctrlKey: boolean;
  metaKey: boolean;
  key: string;
}): boolean =>
  (event.ctrlKey || event.metaKey) &&
  (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y');

/**
 * Outlined formula editor. The document is the stored expression; chips are
 * decorations over complete `{ref}` spans. Pickers must call `insertRef` —
 * do not also write Redux in that path or the echo-sync will fight the caret.
 */
export const ExpressionEditor = forwardRef<
  ExpressionEditorHandle,
  ExpressionEditorProps
>(function ExpressionEditor(
  {
    value,
    onChange,
    catalog,
    error = false,
    disabled = false,
    'data-testid': testId = 'expression-editor',
  },
  ref
) {
  const theme = useTheme();
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastEmittedRef = useRef(value);
  const themeCompartment = useRef(new Compartment());
  const editableCompartment = useRef(new Compartment());
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [docValue, setDocValue] = useState(value);
  /** Active chip tooltip, or null when hidden. */
  const [hover, setHover] = useState<{
    ref: string;
    anchorEl: HTMLElement;
  } | null>(null);

  const debouncedEmit = useMemo(
    () =>
      debounce((next: string) => {
        lastEmittedRef.current = next;
        onChangeRef.current(next);
      }, DEBOUNCE_MS),
    []
  );

  useEffect(
    () => () => {
      debouncedEmit.flush();
      debouncedEmit.cancel();
    },
    [debouncedEmit]
  );

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          Prec.highest(
            keymap.of([
              {key: 'Tab', preventDefault: false, run: () => false},
              {key: 'Shift-Tab', preventDefault: false, run: () => false},
            ])
          ),
          keymap.of(
            // commands may type against a nested @codemirror/view copy
            [...editorHistoryKeymap, ...defaultKeymap] as Parameters<
              typeof keymap.of
            >[0]
          ),
          EditorView.lineWrapping,
          EditorState.changeFilter.of(
            tr => tr.newDoc.length <= INPUT_LIMITS.LONG_TEXT_MAX_LENGTH
          ),
          catalogOf(catalog),
          refChipExtension,
          themeCompartment.current.of(expressionEditorTheme(theme)),
          editableCompartment.current.of(EditorView.editable.of(!disabled)),
          EditorView.updateListener.of(update => {
            if (!update.docChanged) return;
            const next = update.state.doc.toString();
            setDocValue(next);
            // Already in the store: our own emit echoing back, or a value we
            // just applied from undo/redo. Re-dispatching fieldUpdated would
            // push a duplicate undo entry and wipe the redo stack.
            if (next === lastEmittedRef.current) {
              debouncedEmit.cancel();
              return;
            }
            debouncedEmit(next);
          }),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Created once; catalog/theme/disabled/value sync via later effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({effects: reconfigureCatalog(catalog)});
  }, [catalog]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.current.reconfigure(
        expressionEditorTheme(theme)
      ),
    });
  }, [theme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editableCompartment.current.reconfigure(
        EditorView.editable.of(!disabled)
      ),
    });
  }, [disabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value === current) return;
    if (value === lastEmittedRef.current) return;
    // Mark applied before dispatch so the update listener treats this as an
    // echo. Drop in-progress keystrokes — the store is the undo/redo source.
    lastEmittedRef.current = value;
    debouncedEmit.cancel();
    const head = view.state.selection.main.head;
    view.dispatch({
      changes: {from: 0, to: current.length, insert: value},
      selection: {anchor: Math.min(head, value.length)},
      annotations: Transaction.addToHistory.of(false),
    });
    setDocValue(value);
  }, [debouncedEmit, value]);

  useImperativeHandle(ref, () => ({
    insertRef(id: string) {
      const view = viewRef.current;
      if (!view) return;
      insertTokenAtCursor(view, id);
      // Picker insert used to write Redux immediately; flush so Save/undo
      // see the chip without waiting for the typing debounce.
      debouncedEmit.flush();
    },
    focus() {
      viewRef.current?.focus();
    },
    getValue() {
      return viewRef.current?.state.doc.toString() ?? '';
    },
  }));

  /** Cancel a pending popover hide (pointer entered the chip or paper). */
  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  /** Hide the popover after {@link HOVER_CLOSE_MS} unless cleared. */
  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setHover(null), HOVER_CLOSE_MS);
  };

  /** Open / move the tooltip when the pointer is over a chip. */
  const handleMouseOver = useCallback((event: MouseEvent) => {
    const chip = (event.target as HTMLElement | null)?.closest?.(
      `.${EXPR_CHIP_CLASS}`
    );
    if (!(chip instanceof HTMLElement) || !chip.dataset.ref) return;
    clearCloseTimer();
    setHover({ref: chip.dataset.ref, anchorEl: chip});
  }, []);

  /** Start the hide timer unless we moved to a child of the same chip. */
  const handleMouseOut = useCallback((event: MouseEvent) => {
    const related = event.relatedTarget;
    const chip = (event.target as HTMLElement | null)?.closest?.(
      `.${EXPR_CHIP_CLASS}`
    );
    if (
      chip instanceof HTMLElement &&
      related instanceof Node &&
      chip.contains(related)
    ) {
      return;
    }
    scheduleClose();
  }, []);

  const hoverModel: ChipModel | null = hover
    ? (catalog.get(hover.ref) ?? fallbackChipModel(hover.ref))
    : null;

  const tokens = theme.designerMeta.tokens;
  const borderColor = error
    ? theme.palette.error.main
    : alpha(tokens.outlinedInputBorder, 0.38);
  const hoverBorder = error
    ? theme.palette.error.main
    : alpha(tokens.outlinedInputHoverBorder, 0.6);

  return (
    <>
      <Box
        data-testid={testId}
        data-value={docValue}
        role="group"
        aria-label="Expression"
        aria-multiline="true"
        aria-invalid={error || undefined}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        onBlur={event => {
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          ) {
            return;
          }
          debouncedEmit.flush();
        }}
        onKeyDown={(event: KeyboardEvent) => {
          // Fallback if CM does not handle the key (empty history, jsdom).
          if (isDesignerUndoRedoKey(event)) event.stopPropagation();
        }}
        onClick={() => {
          if (!disabled) viewRef.current?.focus();
        }}
        sx={{
          border: '1px solid',
          borderColor,
          borderRadius: theme.shape.borderRadius,
          background: `linear-gradient(135deg, ${tokens.outlinedInputSurface} 0%, ${tokens.outlinedInputSurface} 85%, ${alpha(
            tokens.outlinedInputWash,
            0.18
          )} 100%)`,
          transition:
            'box-shadow 160ms ease, background 160ms ease, border-color 160ms ease',
          cursor: disabled ? 'default' : 'text',
          opacity: disabled ? 0.65 : 1,
          '&:hover': {
            borderColor: hoverBorder,
          },
          '&:focus-within': {
            borderColor: error
              ? theme.palette.error.main
              : tokens.outlinedInputFocusBorder,
            borderWidth: 2,
            boxShadow: error
              ? `0 0 0 3px ${alpha(theme.palette.error.main, 0.16)}, 0 2px 6px ${alpha(
                  theme.palette.common.black,
                  0.08
                )}`
              : `0 0 0 3px ${alpha(tokens.outlinedInputFocusRing, 0.12)}, 0 2px 6px ${alpha(
                  theme.palette.common.black,
                  0.08
                )}`,
          },
        }}
      >
        <Box
          ref={parentRef}
          sx={{'& .cm-editor': {background: 'transparent'}}}
        />
      </Box>
      <Popper
        open={hoverModel !== null}
        anchorEl={hover?.anchorEl}
        placement="top"
        sx={{zIndex: theme.zIndex.tooltip}}
        modifiers={[{name: 'offset', options: {offset: [0, 8]}}]}
      >
        <Paper
          elevation={3}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          {hoverModel && <ExprChipTooltip model={hoverModel} />}
        </Paper>
      </Popper>
    </>
  );
});
