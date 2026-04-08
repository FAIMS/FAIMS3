import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import z from 'zod';
import type {AutosuggestSuggestion} from '../../../addressAutosuggest/types';
import {
  AddressType,
  AddressValue,
  AddressValueSchema,
} from '../../../addressTypes';
import type {FullFormConfig} from '../../../formModule/formManagers/types';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {EmptyResponsePlaceholder} from '../../../rendering/fields/view/wrappers/PrimitiveWrappers';
import {DataViewFieldRender} from '../../../rendering/types';
import {logWarn} from '../../../logging';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

/** Nullable schema for field value (empty when no address entered). */
const AddressValueNullableSchema = AddressValueSchema.nullable();

/**
 * Props schema for AddressField - uses base field props only.
 */
const AddressFieldPropsSchema = BaseFieldPropsSchema.extend({
  /** Enables online autosuggest UI when a service is injected. Defaults to true. */
  enableAutoSuggestion: z.boolean().optional(),
  /**
   * When offline or autosuggest is disabled/unavailable, allow structured entry
   * via address component fields instead of a single free-text input.
   * Defaults to false.
   */
  allowFullAddressManualEntry: z.boolean().optional(),
});

type AddressFieldProps = z.infer<typeof AddressFieldPropsSchema>;
type AddressFieldFullProps = AddressFieldProps & FormFieldContextProps;

const SUGGEST_DEBOUNCE_MS = 300;

/** Synthetic option id for "use search text as address" (unstructured fallback). */
const USE_AS_ENTERED_OPTION_ID = '__use_as_entered__';

/** Option shown in dropdown when user can use their typed text as the address. */
interface UseAsEnteredOption {
  id: typeof USE_AS_ENTERED_OPTION_ID;
  displayText: string;
  secondaryText?: string;
}

function isUseAsEnteredOption(
  opt: AutosuggestSuggestion | UseAsEnteredOption
): opt is UseAsEnteredOption {
  return opt.id === USE_AS_ENTERED_OPTION_ID;
}

/**
 * Build a display name from address parts.
 */
function buildDisplayName(address: AddressType): string {
  const parts = [
    address.house_number,
    address.road,
    address.suburb,
    address.state,
    address.postcode,
  ].filter(Boolean);
  return parts.join(', ');
}

function hasStructuredAddress(value: AddressValue | null): boolean {
  if (!value?.address) return false;
  return Object.values(value.address).some(
    v => v !== null && String(v).trim() !== ''
  );
}

/**
 * AddressField: online search + display with pencil edit, or offline/manual free-text.
 * Value shape: display_name, optional address (from search), optional manuallyEnteredAddress (offline/manual).
 */
const AddressField: React.FC<AddressFieldFullProps> = props => {
  const {
    state,
    setFieldData,
    handleBlur,
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    config,
  } = props;

  const fullConfig = config.mode === 'full' ? (config as FullFormConfig) : null;
  const isOnline = fullConfig?.getIsOnline?.() ?? true;
  const enableAutoSuggestion = props.enableAutoSuggestion ?? true;
  const allowFullAddressManualEntry =
    props.allowFullAddressManualEntry ?? false;
  const autosuggestService = enableAutoSuggestion
    ? fullConfig?.addressAutosuggestService?.()
    : undefined;

  const currentValue = state.value?.data as AddressValue | null;
  const displayName = currentValue?.display_name ?? '';
  const manualText = currentValue?.manuallyEnteredAddress ?? '';
  const address = currentValue?.address ?? {};
  const hasValue = !!(displayName?.trim() || manualText?.trim());
  const hasStructured = hasStructuredAddress(currentValue);

  const [editPanelOpen, setEditPanelOpen] = useState(() => {
    const val = state.value?.data as AddressValue | null;
    const hasVal = !!(
      val?.display_name?.trim() ||
      (val?.manuallyEnteredAddress?.trim() ?? '')
    );
    if (hasVal) return false;
    // No response: expand structural form by default when in manual-only structured mode
    const fullCfg = config.mode === 'full' ? (config as FullFormConfig) : null;
    const isOn = fullCfg?.getIsOnline?.() ?? true;
    const service =
      (props.enableAutoSuggestion ?? true)
        ? fullCfg?.addressAutosuggestService?.()
        : undefined;
    const manualOnly = !isOn || !service;
    const allowStructured = props.allowFullAddressManualEntry ?? false;
    return manualOnly && allowStructured;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutosuggestSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);
  const sessionTokenCounterRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestAbortControllerRef = useRef<AbortController | null>(null);
  const suggestRequestIdRef = useRef(0);

  const showManualOnly = !isOnline || !autosuggestService;
  const showSearchMode =
    isOnline && !!autosuggestService && !hasValue && !editPanelOpen;
  /** Summary row + edit icon: only when we have structured data or are in structured-only mode; not for free-text-only values. */
  const showSummaryRow =
    (hasValue && !editPanelOpen && hasStructured) ||
    (showManualOnly && allowFullAddressManualEntry && !editPanelOpen);
  /** Single text box: free-text-only mode or value is free-text only (no pencil/summary). */
  const showFreeTextOnly =
    (showManualOnly && !allowFullAddressManualEntry) ||
    (hasValue && !hasStructured);

  const ensureSessionToken = useCallback(() => {
    if (!sessionTokenRef.current) {
      // Intentionally avoid `crypto` (Node experimental in our supported range).
      // This token only needs to be unique enough to group autosuggest requests
      // into a "session" for the provider; it is not a security primitive.
      const ts = Date.now().toString(36);
      const rnd = Math.random().toString(36).slice(2);
      const n = (++sessionTokenCounterRef.current).toString(36);
      sessionTokenRef.current = `session-${ts}-${n}-${rnd}`;
    }
    return sessionTokenRef.current;
  }, []);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!autosuggestService || !query.trim()) {
        setSuggestions([]);
        return;
      }
      suggestAbortControllerRef.current?.abort();
      const controller = new AbortController();
      suggestAbortControllerRef.current = controller;
      const requestId = ++suggestRequestIdRef.current;

      setSuggestLoading(true);
      try {
        const sessionToken = ensureSessionToken();
        const list = await autosuggestService.suggest(query.trim(), {
          sessionToken,
          limit: 10,
          signal: controller.signal,
        });
        if (requestId === suggestRequestIdRef.current) {
          setSuggestions(list);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        console.error('Address suggest failed:', err);
        if (requestId === suggestRequestIdRef.current) {
          setSuggestions([]);
        }
      } finally {
        if (requestId === suggestRequestIdRef.current) {
          setSuggestLoading(false);
        }
      }
    },
    [autosuggestService, ensureSessionToken]
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      suggestRequestIdRef.current += 1;
      suggestAbortControllerRef.current?.abort();
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(searchQuery);
      debounceRef.current = null;
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [searchQuery, fetchSuggestions]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: AutosuggestSuggestion) => {
      if (!autosuggestService) return;
      const sessionToken = sessionTokenRef.current;
      if (!sessionToken) return;
      setSuggestLoading(true);
      try {
        const addressValue = await autosuggestService.getAddressFromSuggestion(
          suggestion.id,
          {sessionToken}
        );
        if (addressValue) {
          setFieldData({
            display_name: addressValue.display_name,
            address: addressValue.address ?? {},
            manuallyEnteredAddress: undefined,
          });
          setSearchQuery('');
          setSuggestions([]);
          sessionTokenRef.current = null;
        }
      } catch (err) {
        console.error('Address retrieve failed:', err);
      } finally {
        setSuggestLoading(false);
      }
    },
    [autosuggestService, setFieldData]
  );

  const setStructuredOnly = useCallback(
    (newAddress: AddressType, newDisplayName?: string) => {
      setFieldData({
        display_name: newDisplayName ?? buildDisplayName(newAddress),
        address: newAddress,
        manuallyEnteredAddress: undefined,
      });
    },
    [setFieldData]
  );

  const clearAddress = useCallback(() => {
    setFieldData(null);
    setEditPanelOpen(false);
    setSearchQuery('');
    setSuggestions([]);
    sessionTokenRef.current = null;
  }, [setFieldData]);

  const updateAddressPart = useCallback(
    (key: keyof AddressType) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = {...address, [key]: e.target.value};
      setStructuredOnly(next);
    },
    [address, setStructuredOnly]
  );

  const errors = state.meta.errors as unknown as string[];

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={errors}
    >
      <Box>
        {/* Free-text-only: single text box (no pencil/summary when value is non-structured) */}
        {showFreeTextOnly && (
          <TextField
            label={label}
            value={String(manualText ?? displayName ?? '')}
            placeholder="Enter address"
            fullWidth
            variant="outlined"
            disabled={disabled}
            onBlur={handleBlur}
            onChange={e => {
              const v = e.target.value;
              setFieldData({
                display_name: v,
                manuallyEnteredAddress: v,
                address: undefined,
              });
            }}
          />
        )}

        {/* Online with service, empty: search input + suggestions + fallbacks */}
        {showSearchMode && (
          <Stack spacing={1}>
            <Autocomplete<AutosuggestSuggestion | UseAsEnteredOption>
              value={null}
              inputValue={searchQuery}
              onInputChange={(_, value) => setSearchQuery(value)}
              onChange={(_, option) => {
                if (!option) return;
                if (isUseAsEnteredOption(option)) {
                  const text = searchQuery.trim();
                  if (text) {
                    setFieldData({
                      display_name: text,
                      manuallyEnteredAddress: text,
                      address: undefined,
                    });
                    setSearchQuery('');
                    setSuggestions([]);
                    sessionTokenRef.current = null;
                  }
                  return;
                }
                handleSelectSuggestion(option);
              }}
              options={[
                ...suggestions,
                ...(searchQuery.trim() && !allowFullAddressManualEntry
                  ? [
                      {
                        id: USE_AS_ENTERED_OPTION_ID,
                        displayText: 'Use this address as entered',
                        secondaryText: searchQuery.trim(),
                      } as UseAsEnteredOption,
                    ]
                  : []),
              ]}
              getOptionLabel={opt => opt.displayText}
              loading={suggestLoading}
              disabled={disabled}
              filterOptions={x => x}
              renderOption={(props, option) => {
                if (isUseAsEnteredOption(option)) {
                  return (
                    <li {...props} key={option.id}>
                      <Stack>
                        <Typography
                          variant="body2"
                          sx={{fontStyle: 'italic', color: 'text.secondary'}}
                        >
                          {option.displayText}
                          {option.secondaryText
                            ? ` — "${option.secondaryText}"`
                            : ''}
                        </Typography>
                      </Stack>
                    </li>
                  );
                }
                return (
                  <li {...props} key={option.id}>
                    <Stack>
                      <Typography variant="body2">
                        {option.displayText}
                      </Typography>
                      {option.secondaryText && (
                        <Typography variant="caption" color="text.secondary">
                          {option.secondaryText}
                        </Typography>
                      )}
                    </Stack>
                  </li>
                );
              }}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Search for an address"
                  placeholder="Start typing an address..."
                  onBlur={handleBlur}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {suggestLoading ? (
                          <CircularProgress color="inherit" size={20} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            {allowFullAddressManualEntry && !disabled && (
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => setEditPanelOpen(true)}
                sx={{alignSelf: 'flex-start'}}
              >
                Can&apos;t find your address? Enter manually
              </Button>
            )}
          </Stack>
        )}

        {/* Summary row + edit/expand icon (left): display mode (after autocomplete) or manual-only structured */}
        {showSummaryRow && (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {!disabled && (
              <IconButton
                size="small"
                onClick={() => setEditPanelOpen(!editPanelOpen)}
                aria-label={
                  editPanelOpen ? 'Collapse address form' : 'Edit address'
                }
              >
                {editPanelOpen ? <ExpandLessIcon /> : <EditIcon />}
              </IconButton>
            )}
            <Typography
              variant="body1"
              sx={{
                flex: 1,
                color: displayName ? 'text.primary' : 'text.secondary',
                fontStyle: displayName ? 'normal' : 'italic',
              }}
            >
              {displayName || 'No address entered'}
            </Typography>
          </Stack>
        )}

        {/* Edit panel: only when structured (not for free-text-only value) */}
        <Collapse
          in={editPanelOpen && (hasStructured || allowFullAddressManualEntry)}
        >
          <Stack spacing={2} sx={{mt: 2}}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={clearAddress}
                disabled={disabled}
              >
                {autosuggestService && isOnline
                  ? 'Clear and search again'
                  : 'Clear'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setEditPanelOpen(false)}
                disabled={disabled}
              >
                Done
              </Button>
            </Stack>
            {hasStructured || allowFullAddressManualEntry ? (
              <>
                <TextField
                  label="House Number"
                  value={address.house_number ?? ''}
                  fullWidth
                  variant="outlined"
                  onChange={updateAddressPart('house_number')}
                  onBlur={handleBlur}
                  disabled={disabled}
                />
                <TextField
                  label="Street Name"
                  value={address.road ?? ''}
                  fullWidth
                  variant="outlined"
                  onChange={updateAddressPart('road')}
                  onBlur={handleBlur}
                  disabled={disabled}
                />
                <TextField
                  label="Suburb"
                  value={address.suburb ?? ''}
                  fullWidth
                  variant="outlined"
                  onChange={updateAddressPart('suburb')}
                  onBlur={handleBlur}
                  disabled={disabled}
                />
                <TextField
                  label="State"
                  value={address.state ?? ''}
                  fullWidth
                  variant="outlined"
                  onChange={updateAddressPart('state')}
                  onBlur={handleBlur}
                  disabled={disabled}
                />
                <TextField
                  label="Postcode"
                  value={address.postcode ?? ''}
                  fullWidth
                  variant="outlined"
                  onChange={updateAddressPart('postcode')}
                  onBlur={handleBlur}
                  disabled={disabled}
                />
              </>
            ) : (
              <TextField
                label="Address (free text)"
                value={String(manualText ?? displayName ?? '')}
                fullWidth
                variant="outlined"
                onBlur={handleBlur}
                onChange={e => {
                  const v = e.target.value;
                  setFieldData({
                    display_name: v,
                    manuallyEnteredAddress: v,
                    address: undefined,
                  });
                }}
                disabled={disabled}
              />
            )}
          </Stack>
        </Collapse>
      </Box>
    </FieldWrapper>
  );
};

/**
 * View renderer: show display_name (or manuallyEnteredAddress as fallback).
 */
const AddressFieldRenderer: DataViewFieldRender = props => {
  const value = props.value as AddressValue | null;
  const text =
    value?.display_name?.trim() || value?.manuallyEnteredAddress?.trim();

  if (!text) {
    return <EmptyResponsePlaceholder />;
  }

  return <Typography>{text}</Typography>;
};

/**
 * Validation: required = non-empty display text (display_name or manuallyEnteredAddress).
 */
const valueSchema = (props: AddressFieldProps) => {
  if (props.required) {
    return AddressValueNullableSchema.refine(
      val =>
        val !== null &&
        !!(val.display_name?.trim() || val.manuallyEnteredAddress?.trim() || '')
          .length,
      {message: 'Address is required'}
    );
  }
  return AddressValueNullableSchema;
};

/** Template expansion: parse with AddressValueNullableSchema, then return `display_name`. */
function addressValueForTemplate(value: unknown): string {
  const parsed = AddressValueNullableSchema.safeParse(value);
  if (!parsed.success) {
    logWarn(
      'AddressField templateFunction: value did not match AddressValueNullableSchema:',
      parsed.error.format()
    );
    return '';
  }
  if (parsed.data === null) {
    return '';
  }
  return parsed.data.display_name.trim();
}

export const addressFieldSpec: FieldInfo<AddressFieldFullProps> = {
  namespace: 'faims-custom',
  name: 'AddressField',
  returns: 'faims-core::JSON',
  component: AddressField,
  fieldPropsSchema: AddressFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  templateFunction: addressValueForTemplate,
  view: {
    component: AddressFieldRenderer,
    config: {},
  },
};
