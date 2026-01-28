import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import MicIcon from '@mui/icons-material/Mic';
import {
  Card,
  CardHeader,
  Checkbox,
  FormControlLabel,
  Grid,
  Tooltip,
  Typography,
} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';

/**
 * Speech settings stored in component-parameters
 */
export interface SpeechSettings {
  /** Enable speech-to-text input (default: true) */
  enableSpeech?: boolean;
  /** Whether to append speech to existing text or replace */
  speechAppendMode?: boolean;
}

/**
 * Props for the SpeechSettingsEditor component
 */
interface SpeechSettingsEditorProps {
  /** The field name to edit speech settings for */
  fieldName: string;
}

/**
 * Helper to get speech settings from a field's component-parameters
 */
export const getSpeechSettings = (field: FieldType): SpeechSettings => ({
  enableSpeech: field['component-parameters'].enableSpeech ?? true,
  speechAppendMode: field['component-parameters'].speechAppendMode ?? false,
});

/**
 * Helper to update speech settings in a field's component-parameters
 * Returns a new field object with updated settings
 */
export const updateSpeechSettings = (
  field: FieldType,
  settings: Partial<SpeechSettings>
): FieldType => {
  const newField = JSON.parse(JSON.stringify(field)) as FieldType;

  if (settings.enableSpeech !== undefined) {
    newField['component-parameters'].enableSpeech = settings.enableSpeech;
  }

  if (settings.speechAppendMode !== undefined) {
    newField['component-parameters'].speechAppendMode =
      settings.speechAppendMode;
  }

  return newField;
};

/**
 * A reusable component for configuring speech-to-text settings on text-based fields.
 *
 * This module can be embedded into any field editor that supports text input
 * (TextField, MultilineTextField, etc.) to provide consistent speech configuration.
 *
 * @example
 * ```tsx
 * import {SpeechSettingsEditor} from './SpeechSettingsEditor';
 *
 * export const TextFieldEditor = ({fieldName}: {fieldName: string}) => {
 *   return (
 *     <BaseFieldEditor fieldName={fieldName}>
 *       {/* Other field-specific settings *\/}
 *       <SpeechSettingsEditor fieldName={fieldName} />
 *     </BaseFieldEditor>
 *   );
 * };
 * ```
 */
export const SpeechSettingsEditor = ({
  fieldName,
}: SpeechSettingsEditorProps) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const settings = getSpeechSettings(field);

  const handleSettingChange = (
    setting: keyof SpeechSettings,
    value: boolean
  ) => {
    const newField = updateSpeechSettings(field, {[setting]: value});
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  return (
    <Grid item xs={12}>
      <Card variant="outlined">
        <CardHeader
          avatar={<MicIcon color="action" />}
          title={
            <Typography variant="subtitle2">Speech-to-Text Settings</Typography>
          }
          sx={{pb: 0}}
        />
        <Grid container p={2} pt={1} rowGap={1}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={settings.enableSpeech}
                  onChange={e =>
                    handleSettingChange('enableSpeech', e.target.checked)
                  }
                />
              }
              label={
                <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                  Enable voice-to-text input for this field
                  <Tooltip title="When enabled, users can tap a microphone button to dictate text using their device's speech recognition. This is useful for hands-free data entry in the field.">
                    <HelpOutlineIcon
                      fontSize="small"
                      sx={{color: 'action.active', cursor: 'help'}}
                    />
                  </Tooltip>
                </span>
              }
            />
          </Grid>

          {settings.enableSpeech && (
            <Grid item xs={12} sx={{pl: 4}}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.speechAppendMode}
                    onChange={e =>
                      handleSettingChange('speechAppendMode', e.target.checked)
                    }
                  />
                }
                label={
                  <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                    Append text to the end of input instead of replacing
                    <Tooltip title="When enabled, each speech recognition result will be added to the end of any existing text in the field. When disabled, new speech input will replace the current field value entirely.">
                      <HelpOutlineIcon
                        fontSize="small"
                        sx={{color: 'action.active', cursor: 'help'}}
                      />
                    </Tooltip>
                  </span>
                }
              />
            </Grid>
          )}
        </Grid>
      </Card>
    </Grid>
  );
};

export default SpeechSettingsEditor;
