import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import {
  Collapse,
  IconButton,
  Stack,
  TextField,
  Typography,
  Box,
  Autocomplete,
  Button,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ClearIcon from '@mui/icons-material/Clear';
import z from 'zod';
import {
  AddressType,
  AddressValue,
  AddressValueSchema,
} from '../../../addressTypes';
import type {AutosuggestSuggestion} from '../../../addressAutosuggest/types';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import type {FullFormConfig} from '../../../formModule/formManagers/types';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';
import {DataViewFieldRender} from '../../../rendering/types';
import {EmptyResponsePlaceholder} from '../../../rendering/fields/view/wrappers/PrimitiveWrappers';

/** Nullable schema for field value (empty when no address entered). */
const AddressValueNullableSchema = AddressValueSchema.nullable();

/**
 * Props schema for AddressField - uses base field props only.
 */
const AddressFieldPropsSchema = BaseFieldPropsSchema.extend({});

type AddressFieldProps = z.infer<typeof AddressFieldPropsSchema>;
type AddressFieldFullProps = AddressFieldProps & FormFieldContextProps;

const SUGGEST_DEBOUNCE_MS = 300;

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
  return Object.values(value.address).some(v => v != null && String(v).trim() !== '');
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
  const autosuggestService = fullConfig?.addressAutosuggestService?.();

  const currentValue = state.value?.data as AddressValue | null;
  const displayName = currentValue?.display_name ?? '';
  const manualText = currentValue?.manuallyEnteredAddress ?? '';
  const address = currentValue?.address ?? {};
  const hasValue = !!(displayName?.trim() || manualText?.trim());
  const hasStructured = hasStructuredAddress(currentValue);

  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutosuggestSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestAbortControllerRef = useRef<AbortController | null>(null);
  const suggestRequestIdRef = useRef(0);

  const showManualOnly = !isOnline || !autosuggestService;
  const showSearchMode = isOnline && !!autosuggestService && !hasValue && !editPanelOpen;
  const showDisplayMode = hasValue && !editPanelOpen;

  const ensureSessionToken = useCallback(() => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

  const setManualOnly = useCallback(
    (text: string) => {
      setFieldData({
        display_name: text,
        manuallyEnteredAddress: text,
        address: undefined,
      });
    },
    [setFieldData]
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
      const next = { ...address, [key]: e.target.value };
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

        {/* Offline or no service: single free-text field */}
        {showManualOnly && (
          <TextField
            label={label}
            value={hasValue ? (manualText || displayName) : ''}
            placeholder="Enter address"
            fullWidth
            variant="outlined"
            disabled={disabled}
            onBlur={handleBlur}
            onChange={e => setManualOnly(e.target.value)}
          />
        )}

        {/* Online with service, empty: search input + suggestions */}
        {showSearchMode && (
          <Autocomplete<AutosuggestSuggestion>
            value={null}
            inputValue={searchQuery}
            onInputChange={(_, value) => setSearchQuery(value)}
            onChange={(_, option) => {
              if (option) handleSelectSuggestion(option);
            }}
            options={suggestions}
            getOptionLabel={opt => opt.displayText}
            loading={suggestLoading}
            disabled={disabled}
            filterOptions={x => x}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack>
                  <Typography variant="body2">{option.displayText}</Typography>
                  {option.secondaryText && (
                    <Typography variant="caption" color="text.secondary">
                      {option.secondaryText}
                    </Typography>
                  )}
                </Stack>
              </li>
            )}
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
        )}

        {/* Has value: show display name + pencil */}
        {showDisplayMode && !showManualOnly && (
          <Stack direction="row" alignItems="center" spacing={0.5}>
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
            {!disabled && (
              <IconButton
                size="small"
                onClick={() => setEditPanelOpen(true)}
                aria-label="Edit address"
              >
                <EditIcon />
              </IconButton>
            )}
          </Stack>
        )}

        {/* Pencil expanded: manual parts (if structured) or single text (if manual) + Clear */}
        <Collapse in={editPanelOpen}>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {hasStructured ? (
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
                value={manualText || displayName}
                fullWidth
                variant="outlined"
                onChange={e => setManualOnly(e.target.value)}
                onBlur={handleBlur}
                disabled={disabled}
              />
            )}
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={clearAddress}
                disabled={disabled}
              >
                {autosuggestService && isOnline ? 'Clear and search again' : 'Clear'}
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
  const text = value?.display_name?.trim() || value?.manuallyEnteredAddress?.trim();

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
        !!(
          (val.display_name?.trim() || val.manuallyEnteredAddress?.trim() || '')
            .length
        ),
      { message: 'Address is required' }
    );
  }
  return AddressValueNullableSchema;
};

export const addressFieldSpec: FieldInfo<AddressFieldFullProps> = {
  namespace: 'faims-custom',
  name: 'AddressField',
  returns: 'faims-core::JSON',
  component: AddressField,
  fieldPropsSchema: AddressFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {
    component: AddressFieldRenderer,
    config: {},
  },
};
