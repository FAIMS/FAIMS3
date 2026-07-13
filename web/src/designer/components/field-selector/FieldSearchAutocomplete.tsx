/**
 * @file Autocomplete field picker with scoped fuzzy search for condition editors and computed fields.
 */

import {TextField} from '@mui/material';
import {designerHtmlInput, INPUT_LIMITS} from '../../lib/input-limits';
import Autocomplete, {AutocompleteProps} from '@mui/material/Autocomplete';
import {useEffect, useMemo} from 'react';
import {
  buildFieldSearchEntry,
  FieldSearchFilters,
  FieldSearchResult,
  FieldSearchScope,
  resolveFieldLocation,
  useFieldSearch,
} from '../../features/field-search';
import type {FieldType} from '../../state/initial';
import {
  selectUiFields,
  selectUiViews,
  selectUiViewSets,
} from '../../store/selectors';
import {useAppSelector} from '../../state/hooks';
import {
  renderFuzzysortHighlight,
  SearchResultContent,
} from '../../features/search';

type FieldSearchOptionProps = {
  result: FieldSearchResult;
  query: string;
};

/** Form › section breadcrumb matching global design search field rows. */
const formatFieldLocationLabel = (result: FieldSearchResult): string | null => {
  if (!result.viewSetLabel) return null;
  return result.sectionLabel
    ? `${result.viewSetLabel} › ${result.sectionLabel}`
    : result.viewSetLabel;
};

/** Renders a field option with optional fuzzy-match highlighting on the label. */
export const FieldSearchOption = ({result, query}: FieldSearchOptionProps) => {
  const hasSearch = query.trim().length > 0 && result.fuzzysort;
  const detailLabel = result.helperText || null;
  const locationLabel = formatFieldLocationLabel(result);

  const titleContent = useMemo(() => {
    if (!hasSearch) return result.label;
    // fuzzysort key order: label (0), id (1), helperText (2), advancedHelperText (3)
    return renderFuzzysortHighlight(result.fuzzysort?.[0], result.label);
  }, [hasSearch, result]);

  const detailContent = useMemo(() => {
    if (!detailLabel) return null;
    if (!hasSearch) return detailLabel;
    return renderFuzzysortHighlight(result.fuzzysort?.[2], detailLabel);
  }, [detailLabel, hasSearch, result]);

  const locationContent = locationLabel;

  return (
    <SearchResultContent
      title={titleContent}
      detail={detailContent}
      location={locationContent}
    />
  );
};

export type FieldSearchAutocompleteProps = {
  value: string | null;
  onChange: (fieldId: string | null) => void;
  scope: FieldSearchScope;
  filters?: FieldSearchFilters;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  limit?: number;
  /** Shown when no fields match scope/filters. */
  noOptionsText?: string;
  /** Minimum width of the control (default 200). */
  minWidth?: number | string;
  'data-testid'?: string;
  sx?: AutocompleteProps<FieldSearchResult, false, false, false>['sx'];
  size?: 'small' | 'medium';
  clearOnEscape?: boolean;
  /** Clear the search input after a field is selected (for insert/picker use cases). */
  clearOnSelect?: boolean;
};

/**
 * Compact autocomplete for picking a field from the current design.
 * Uses {@link useFieldSearch} for scoped filtering and weighted fuzzy ranking.
 */
export const FieldSearchAutocomplete = ({
  value,
  onChange,
  scope,
  filters,
  label = 'Field',
  placeholder,
  disabled = false,
  limit = 50,
  noOptionsText = 'No matching fields',
  minWidth = 200,
  'data-testid': testId,
  sx,
  size = 'medium',
  clearOnEscape = true,
  clearOnSelect = false,
}: FieldSearchAutocompleteProps) => {
  const allFields = useAppSelector(selectUiFields);
  const views = useAppSelector(selectUiViews);
  const viewsets = useAppSelector(selectUiViewSets);
  const {query, setQuery, searchQuery, results, candidateCount} =
    useFieldSearch({
      scope,
      filters,
      limit,
    });

  const selectedResult = useMemo((): FieldSearchResult | null => {
    if (!value) return null;
    const fromResults = results.find(r => r.fieldId === value);
    if (fromResults) return fromResults;
    // Selected id may be outside current search results — synthesize a display row.
    const field = allFields[value];
    if (!field) {
      return {
        fieldId: value,
        field: textFieldFallback(),
        label: value,
        helperText: '',
        viewSetLabel: '',
        sectionLabel: '',
        score: 0,
      };
    }
    const entry = buildFieldSearchEntry(
      value,
      field,
      resolveFieldLocation(value, views, viewsets)
    );
    return {
      fieldId: value,
      field,
      label: entry.label,
      helperText: entry.helperText,
      viewSetLabel: entry.viewSetLabel,
      sectionLabel: entry.sectionLabel,
      score: 0,
    };
  }, [value, results, allFields, views, viewsets]);

  // Seed the input with the selected field label when controlled value changes externally.
  useEffect(() => {
    if (value && selectedResult && !query) {
      setQuery(selectedResult.label);
    }
  }, [value, selectedResult, query, setQuery]);

  return (
    <Autocomplete
      options={results}
      value={value ? selectedResult : null}
      inputValue={query}
      onInputChange={(_, newInput, reason) => {
        if (reason === 'input' || reason === 'clear') {
          setQuery(newInput);
        }
        if (reason === 'reset' && value) {
          const match = results.find(r => r.fieldId === value);
          setQuery(match?.label ?? value);
        }
      }}
      onChange={(_, option) => {
        const fieldId = option?.fieldId ?? null;
        onChange(fieldId);
        setQuery(clearOnSelect && fieldId ? '' : (option?.label ?? ''));
      }}
      getOptionLabel={option => option.label}
      isOptionEqualToValue={(option, selected) =>
        option.fieldId === selected.fieldId
      }
      // Ranking is handled by useFieldSearch — disable MUI's built-in string filter.
      filterOptions={options => options}
      disabled={disabled || candidateCount === 0}
      noOptionsText={noOptionsText}
      clearOnEscape={clearOnEscape}
      data-testid={testId}
      size={size}
      sx={{minWidth, ...sx}}
      renderOption={(props, option) => (
        <li
          {...props}
          key={option.fieldId}
          style={{...props.style, display: 'flex', width: '100%'}}
        >
          <FieldSearchOption result={option} query={searchQuery} />
        </li>
      )}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          variant="outlined"
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...(params.slotProps?.htmlInput as object | undefined),
              ...designerHtmlInput(INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH),
            },
          }}
        />
      )}
    />
  );
};

/** Minimal field stub when a selected id is missing from the store. */
const textFieldFallback = (): FieldType =>
  ({
    'component-namespace': 'faims-custom',
    'component-name': 'TextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {name: '', label: ''},
    initialValue: '',
  }) as FieldType;
