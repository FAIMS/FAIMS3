/**
 * @file Global designer search bar — fuzzy search across forms, sections, and fields.
 *
 * Press `/` (when not typing in an input) to focus. Selecting a result navigates
 * to the correct design tab and scrolls to the target element.
 */

import SearchIcon from '@mui/icons-material/Search';
import {designerHtmlInput, INPUT_LIMITS} from '../../lib/input-limits';
import {Box, Chip, TextField} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {
  designSearchTypeLabel,
  DesignSearchResult,
  useDesignSearch,
} from '../../features/design-search';
import {
  renderFuzzysortHighlight,
  SearchResultContent,
} from '../../features/search';
import {
  scrollToField,
  scrollToForm,
  scrollToSection,
  type DesignerNavigationContext,
} from '../../features/navigation';
import {
  selectUiViews,
  selectUiViewSets,
  selectVisibleTypes,
} from '../../store/selectors';
import {useAppSelector} from '../../state/hooks';
import {designerSearchShortcutHintSx} from '../designer-style';

type DesignSearchOptionProps = {
  result: DesignSearchResult;
  searchQuery: string;
};

/** Returns true when `/` should not steal focus (user is already editing text). */
const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  return (
    target.isContentEditable || !!target.closest('[contenteditable="true"]')
  );
};

const SEARCH_WIDTH = {
  xs: '100%',
  sm: 340,
  md: 420,
  lg: 480,
  xl: 520,
} as const;

/** Fixed width for the type badge column — fits "Section" (longest label). */
const TYPE_BADGE_COLUMN_WIDTH = 64;

/** One row in the global search dropdown (type badge + title + context lines). */
const DesignSearchOption = ({result, searchQuery}: DesignSearchOptionProps) => {
  const hasSearch = searchQuery.trim().length > 0 && result.fuzzysort;

  const titleContent = useMemo(() => {
    if (!hasSearch) return result.label;
    // fuzzysort key order: label (0), id (1), helperText (2), advancedHelperText (3)
    return renderFuzzysortHighlight(result.fuzzysort?.[0], result.label);
  }, [hasSearch, result]);

  /** Form for sections; form › section for fields. */
  const locationLabel = useMemo(() => {
    switch (result.type) {
      case 'section':
        return result.viewSetLabel;
      case 'field':
        return result.sectionLabel
          ? `${result.viewSetLabel} › ${result.sectionLabel}`
          : result.viewSetLabel;
      default:
        return null;
    }
  }, [result]);

  const detailLabel = useMemo(() => {
    switch (result.type) {
      case 'form':
        return result.helperText;
      case 'field':
        return result.helperText || null;
      default:
        return null;
    }
  }, [result]);

  const detailContent = useMemo(() => {
    if (!detailLabel) return null;
    if (!hasSearch || result.type !== 'field') return detailLabel;
    return renderFuzzysortHighlight(result.fuzzysort?.[2], detailLabel);
  }, [detailLabel, hasSearch, result]);

  const locationContent = useMemo(() => {
    if (!locationLabel) return null;
    if (!hasSearch || result.type !== 'section') return locationLabel;
    // Section entries store the parent form label in helperText for search.
    return renderFuzzysortHighlight(result.fuzzysort?.[2], locationLabel);
  }, [hasSearch, locationLabel, result]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `${TYPE_BADGE_COLUMN_WIDTH}px minmax(0, 1fr)`,
        gap: 1.25,
        alignItems: 'center',
        width: '100%',
        py: 0.25,
      }}
    >
      <Chip
        label={designSearchTypeLabel[result.type]}
        size="small"
        variant="outlined"
        sx={{
          justifySelf: 'center',
          width: '100%',
          maxWidth: TYPE_BADGE_COLUMN_WIDTH,
          fontWeight: 600,
          fontSize: '0.68rem',
          height: 22,
          '& .MuiChip-label': {
            px: 0.5,
            width: '100%',
            textAlign: 'center',
          },
        }}
      />
      <SearchResultContent
        title={titleContent}
        detail={detailContent}
        location={locationContent}
      />
    </Box>
  );
};

/** Global designer search for forms, sections, and fields. */
export const DesignerGlobalSearch = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const {pathname} = useLocation();
  // Preserve notebook prefix, e.g. `/notebook/:id/design` → `/notebook/:id/design`.
  const designPath = pathname.split('/').slice(0, 2).join('/') || '/design';

  const visibleTypes = useAppSelector(selectVisibleTypes);
  const viewsets = useAppSelector(selectUiViewSets);
  const views = useAppSelector(selectUiViews);
  // Hidden forms still have tab indices — they appear after visible ones in the tab bar.
  const untickedForms = useMemo(
    () =>
      Object.keys(viewsets).filter(formId => !visibleTypes.includes(formId)),
    [viewsets, visibleTypes]
  );

  const {query, setQuery, searchQuery, results, candidateCount} =
    useDesignSearch();

  const navigationContext = useMemo(
    (): DesignerNavigationContext => ({
      navigate,
      designPath,
      visibleTypes,
      untickedForms,
      viewsets,
      views,
    }),
    [navigate, designPath, visibleTypes, untickedForms, viewsets, views]
  );

  const handleSelect = useCallback(
    (result: DesignSearchResult | null) => {
      if (!result) return;

      switch (result.type) {
        case 'form':
          scrollToForm(result.viewSetId, navigationContext);
          break;
        case 'section':
          if (result.sectionId) {
            scrollToSection(result.sectionId, navigationContext);
          }
          break;
        case 'field':
          if (result.fieldId) {
            scrollToField(result.fieldId, navigationContext);
          }
          break;
      }

      setQuery('');
    },
    [navigationContext, setQuery]
  );

  const focusSearch = useCallback(() => {
    inputRef.current?.focus();
    setOpen(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (candidateCount === 0) return;
      if (isEditableTarget(event.target)) return;
      if (document.activeElement === inputRef.current) return;

      event.preventDefault();
      focusSearch();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [candidateCount, focusSearch]);

  return (
    <Autocomplete
      options={results}
      value={null}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      inputValue={query}
      onInputChange={(_, value, reason) => {
        if (reason === 'input' || reason === 'clear') {
          setQuery(value);
        }
      }}
      onChange={(_, option) => handleSelect(option)}
      getOptionLabel={option => option.label}
      isOptionEqualToValue={(option, selected) =>
        option.resultId === selected.resultId
      }
      // Ranking is handled by useDesignSearch — disable MUI's built-in string filter.
      filterOptions={options => options}
      disabled={candidateCount === 0}
      noOptionsText={
        query.trim()
          ? 'No matching elements'
          : 'Search forms, sections, and fields'
      }
      clearOnEscape
      size="small"
      sx={{width: SEARCH_WIDTH, maxWidth: '100%', flexShrink: 0}}
      slotProps={{
        popper: {
          placement: 'bottom-end',
          sx: {zIndex: theme => theme.zIndex.modal + 1},
        },
      }}
      renderOption={(props, option) => (
        <li
          {...props}
          key={option.resultId}
          style={{...props.style, display: 'flex', width: '100%'}}
        >
          <DesignSearchOption result={option} searchQuery={searchQuery} />
        </li>
      )}
      renderInput={params => (
        <TextField
          {...params}
          placeholder="Search design…"
          aria-label="Search forms, sections, and fields (press / to focus)"
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...params.slotProps.htmlInput,
              ...designerHtmlInput(INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH),
              ref: (node: HTMLInputElement | null) => {
                inputRef.current = node;
                const htmlInputRef = params.slotProps.htmlInput.ref;
                if (typeof htmlInputRef === 'function') {
                  htmlInputRef(node);
                } else if (htmlInputRef && typeof htmlInputRef === 'object') {
                  (
                    htmlInputRef as React.MutableRefObject<HTMLInputElement | null>
                  ).current = node;
                }
              },
              onFocus: (event: FocusEvent<HTMLInputElement>) => {
                setFocused(true);
                params.slotProps.htmlInput.onFocus?.(event);
              },
              onBlur: (event: FocusEvent<HTMLInputElement>) => {
                setFocused(false);
                params.slotProps.htmlInput.onBlur?.(event);
              },
            },
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <>
                  <SearchIcon
                    fontSize="small"
                    sx={{color: 'text.secondary', mr: 0.75, ml: 0.25}}
                  />
                  {params.slotProps.input.startAdornment}
                </>
              ),
              endAdornment: (
                <>
                  {!query && !focused && (
                    <Box
                      component="kbd"
                      aria-hidden
                      sx={designerSearchShortcutHintSx}
                    >
                      /
                    </Box>
                  )}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
};
