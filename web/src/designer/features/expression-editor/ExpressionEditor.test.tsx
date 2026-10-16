// SPDX-License-Identifier: Apache-2.0
/**
 * @file Component tests for chips, atomic delete, caret insert, and debounce.
 */
import {deleteCharBackward, undo} from '@codemirror/commands';
import {EditorView} from '@codemirror/view';
import {ThemeProvider} from '@mui/material/styles';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {createRef} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import globalTheme from '../../theme/index';
import {createChipCatalog} from './chipModel';
import {
  ExpressionEditor,
  type ExpressionEditorHandle,
} from './ExpressionEditor';
import {
  CHIP_LABEL_MAX_LENGTH,
  EXPR_CHIP_CLASS,
  truncateChipLabel,
} from './refChipExtension';
import type {FieldType} from '../../state/initial';

/** Minimal number field for editor tests. */
const field = (id: string, label: string): FieldType =>
  ({
    'component-namespace': 'faims-custom',
    'component-name': 'NumberField',
    'type-returned': 'faims-core::Number',
    exportName: label,
    'component-parameters': {
      name: id,
      label,
      helperText: '',
      advancedHelperText: '',
      required: false,
    },
    initialValue: 0,
  }) as FieldType;

/** Shared catalog: Site Name, Width, and a long-label field. */
const catalog = createChipCatalog({
  fields: {
    f_abc: field('f_abc', 'Site Name'),
    f_xyz: field('f_xyz', 'Width'),
    f_long: field(
      'f_long',
      'A very long field label that should be truncated on the chip face'
    ),
  },
  views: {sectionA: {label: 'Section A', fields: ['f_abc', 'f_xyz']}},
  viewsets: {formA: {label: 'Form A', views: ['sectionA']}},
  customMetadataKeys: [],
});

/** The live CodeMirror view mounted by the last {@link renderEditor} call. */
const viewFromEditor = (): EditorView => {
  const el = document.querySelector(
    '[data-testid="expression-editor"] .cm-editor'
  );
  const view = el instanceof HTMLElement ? EditorView.findFromDOM(el) : null;
  if (!view) throw new Error('EditorView not found');
  return view;
};

/** Mount {@link ExpressionEditor} with the shared catalog and optional overrides. */
const renderEditor = (
  props: Partial<{
    value: string;
    onChange: (value: string) => void;
  }> = {}
) => {
  const handle = createRef<ExpressionEditorHandle>();
  const onChange = props.onChange ?? vi.fn();
  const result = render(
    <ThemeProvider theme={globalTheme}>
      <ExpressionEditor
        ref={handle}
        value={props.value ?? '{f_abc} * 2'}
        onChange={onChange}
        catalog={catalog}
      />
    </ThemeProvider>
  );
  return {handle, onChange, ...result};
};

describe('ExpressionEditor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a chip for a complete reference and leaves operators as text', () => {
    renderEditor();
    const chip = document.querySelector(`.${EXPR_CHIP_CLASS}`);
    expect(chip?.textContent).toBe('Site Name');
    expect(
      screen.getByTestId('expression-editor').getAttribute('data-value')
    ).toBe('{f_abc} * 2');
    expect(document.querySelector('.cm-content')?.textContent).toContain('*');
    expect(document.querySelector('.cm-content')?.textContent).toContain('2');
  });

  it('truncates a long chip face with ... and keeps the full label in the model', () => {
    const long =
      'A very long field label that should be truncated on the chip face';
    renderEditor({value: '{f_long}'});
    expect(document.querySelector(`.${EXPR_CHIP_CLASS}`)?.textContent).toBe(
      truncateChipLabel(long)
    );
    expect(truncateChipLabel(long)).toBe(
      `${long.slice(0, CHIP_LABEL_MAX_LENGTH)}...`
    );
    expect(catalog.get('f_long')?.label).toBe(long);
  });

  it('promotes a completed brace span to a chip', () => {
    renderEditor({value: ''});
    const view = viewFromEditor();
    act(() => {
      view.dispatch({changes: {from: 0, insert: '{f_abc}'}});
    });
    expect(document.querySelector(`.${EXPR_CHIP_CLASS}`)?.textContent).toBe(
      'Site Name'
    );
  });

  it('deletes an entire chip on backspace', () => {
    const {handle} = renderEditor({value: '{f_abc} * 2'});
    const view = viewFromEditor();
    act(() => {
      view.dispatch({selection: {anchor: '{f_abc}'.length}});
      deleteCharBackward(view as never);
    });
    expect(handle.current?.getValue()).toBe(' * 2');
    expect(document.querySelector(`.${EXPR_CHIP_CLASS}`)).toBeNull();
  });

  it('inserts a reference at the caret, not only at the end', () => {
    const {handle} = renderEditor({value: '1 + 2'});
    const view = viewFromEditor();
    act(() => {
      view.dispatch({selection: {anchor: 1}});
      handle.current?.insertRef('f_xyz');
    });
    expect(handle.current?.getValue()).toBe('1 {f_xyz} + 2');
    expect(document.querySelector(`.${EXPR_CHIP_CLASS}`)?.textContent).toBe(
      'Width'
    );
  });

  it('debounces onChange', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderEditor({value: '', onChange});
    const view = viewFromEditor();
    act(() => {
      view.dispatch({changes: {from: 0, insert: '1 + 2'}});
    });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('1 + 2');
  });

  it('does not reset the document when value is our own echo', () => {
    const onChange = vi.fn();
    const {rerender, handle} = renderEditor({value: 'abc', onChange});
    const view = viewFromEditor();
    act(() => {
      view.dispatch({
        changes: {from: 3, insert: 'd'},
        selection: {anchor: 4},
      });
    });
    expect(handle.current?.getValue()).toBe('abcd');
    rerender(
      <ThemeProvider theme={globalTheme}>
        <ExpressionEditor
          ref={handle}
          value="abc"
          onChange={onChange}
          catalog={catalog}
        />
      </ThemeProvider>
    );
    // Echo of the pre-debounce value must not clobber in-progress typing.
    expect(handle.current?.getValue()).toBe('abcd');
  });

  it('does not re-emit when value is applied from undo/redo', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const {rerender, handle} = renderEditor({value: 'new', onChange});
    rerender(
      <ThemeProvider theme={globalTheme}>
        <ExpressionEditor
          ref={handle}
          value="old"
          onChange={onChange}
          catalog={catalog}
        />
      </ThemeProvider>
    );
    expect(handle.current?.getValue()).toBe('old');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drops in-progress typing when an external value is applied', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const {rerender, handle} = renderEditor({value: 'old', onChange});
    const view = viewFromEditor();
    act(() => {
      view.dispatch({changes: {from: 3, insert: 'x'}});
    });
    expect(handle.current?.getValue()).toBe('oldx');
    rerender(
      <ThemeProvider theme={globalTheme}>
        <ExpressionEditor
          ref={handle}
          value="undone"
          onChange={onChange}
          catalog={catalog}
        />
      </ThemeProvider>
    );
    expect(handle.current?.getValue()).toBe('undone');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('flushes pending onChange when focus leaves the editor', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderEditor({value: '', onChange});
    const view = viewFromEditor();
    act(() => {
      view.dispatch({changes: {from: 0, insert: '1 + 2'}});
    });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      fireEvent.blur(screen.getByTestId('expression-editor'));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('1 + 2');
  });

  it('flushes onChange immediately on picker insert', () => {
    const onChange = vi.fn();
    const {handle} = renderEditor({value: '', onChange});
    act(() => {
      handle.current?.insertRef('f_xyz');
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('{f_xyz}');
  });

  it('undoes in the editor without letting Mod-z reach a window listener', () => {
    const onWindowUndo = vi.fn();
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        onWindowUndo();
      }
    };
    window.addEventListener('keydown', onWindowKeyDown);
    const {handle} = renderEditor({value: 'ab'});
    const view = viewFromEditor();
    act(() => {
      view.dispatch({changes: {from: 2, insert: 'c'}});
    });
    expect(handle.current?.getValue()).toBe('abc');

    try {
      act(() => {
        undo(view as never);
      });
      expect(handle.current?.getValue()).toBe('ab');

      fireEvent.keyDown(screen.getByTestId('expression-editor'), {
        key: 'z',
        ctrlKey: true,
      });
      expect(onWindowUndo).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', onWindowKeyDown);
    }
  });
});
