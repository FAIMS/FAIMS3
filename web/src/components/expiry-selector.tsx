import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getDaysDifference,
  formatDisplayDate,
  formatDateTimeLocal,
} from '@/lib/utils';
import {AlertTriangle, Calendar, Clock} from 'lucide-react';
import React, {useState} from 'react';

export interface ExpirySelectorProps {
  /** List of duration hints in days. If undefined/empty, hints mode is disabled */
  hints?: number[];
  /** Maximum duration in days. If undefined, no maximum limit */
  maxDurationDays?: number;
  /** Currently selected datetime as ISO string or undefined for never expires */
  selectedDateTime?: string | undefined;
  /** Callback when datetime selection changes */
  setSelectedDateTime: (datetime: string | undefined) => void;
  /** Main title for the selector */
  title?: string;
  /** Subtitle/description text */
  subtitle?: string;
  /** Label for hints dropdown */
  hintsLabel?: string;
  /** Label for custom datetime input */
  customLabel?: string;
  /** Placeholder text for hints dropdown */
  hintsPlaceholder?: string;
  /** Text for quick select button */
  quickSelectText?: string;
  /** Text for custom date button */
  customDateText?: string;
  /** Text for never expires option */
  neverExpiresText?: string;
  /** Text shown before the current selection */
  currentSelectionPrefix?: string;
  /** Warning title for never expires */
  neverExpiresWarningTitle?: string;
  /** Warning message for never expires */
  neverExpiresWarningMessage?: string;
  /** Show maximum duration info */
  showMaxDurationInfo?: boolean;
  /** Maximum token duration message prefix {message}: {days} days */
  maximumDurationPrefix?: string;
}

type SelectionMode = 'hints' | 'custom';

export const ExpirySelector: React.FC<ExpirySelectorProps> = ({
  hints = [],
  maxDurationDays,
  selectedDateTime,
  setSelectedDateTime,
  title = 'Token Duration',
  subtitle,
  hintsLabel = 'Select duration:',
  customLabel = 'Select expiry date and time:',
  hintsPlaceholder = 'Choose a duration...',
  quickSelectText = 'Quick Select',
  customDateText = 'Custom Date',
  neverExpiresText = 'Never expires',
  currentSelectionPrefix = 'Current Selection:',
  neverExpiresWarningTitle = 'Security Warning',
  maximumDurationPrefix = 'Maximum token duration',
  neverExpiresWarningMessage = "This token will never expire automatically. Make sure to revoke it manually when it's no longer needed.",
  showMaxDurationInfo = true,
}) => {
  const [mode, setMode] = useState<SelectionMode>(() => {
    // Default to hints mode if hints are available, otherwise custom
    return hints.length > 0 ? 'hints' : 'custom';
  });

  const now = new Date();
  const hasHints = hints.length > 0;
  const neverExpiryAllowed = maxDurationDays === undefined;

  // Calculate min and max dates for the datetime input
  const minDate = new Date(now.getTime() + 60 * 1000); // 1 minute from now
  const maxDate = maxDurationDays
    ? new Date(now.getTime() + maxDurationDays * 24 * 60 * 60 * 1000)
    : undefined;

  // Get current expiry date based on selection
  const getCurrentExpiryDate = (): Date | undefined => {
    if (!selectedDateTime) return undefined;
    if (selectedDateTime === 'never') return undefined;
    return new Date(selectedDateTime);
  };

  // Get display text for current selection
  const getExpiryDisplayText = (): string => {
    if (!selectedDateTime) {
      return 'No expiry date selected';
    }

    if (selectedDateTime === 'never') {
      return neverExpiresText;
    }

    const expiryDate = getCurrentExpiryDate();
    if (!expiryDate) {
      return 'Invalid date selected';
    }

    const daysDiff = getDaysDifference(expiryDate);
    const formattedDate = formatDisplayDate(expiryDate);
    return `Expiring at ${formattedDate}, ${daysDiff} day${daysDiff !== 1 ? 's' : ''} from now`;
  };

  // Get hint value from current selection
  const getHintValueFromSelection = (): string => {
    if (!selectedDateTime || selectedDateTime === 'never') {
      return selectedDateTime === 'never' ? 'never' : '';
    }

    const expiryDate = getCurrentExpiryDate();
    if (!expiryDate) return '';

    const daysDiff = getDaysDifference(expiryDate);

    // Check if this matches any of our hints
    if (hints.includes(daysDiff)) {
      return daysDiff.toString();
    }

    return '';
  };

  // Handle hint selection change
  const handleHintChange = (value: string) => {
    if (value === 'never') {
      setSelectedDateTime('never');
    } else {
      const days = parseInt(value, 10);
      const expiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      setSelectedDateTime(expiryDate.toISOString());
    }
  };

  // Handle custom datetime change
  const handleCustomDateTimeChange = (value: string) => {
    if (value) {
      const date = new Date(value);
      setSelectedDateTime(date.toISOString());
    } else {
      setSelectedDateTime(undefined);
    }
  };

  // Switch to custom mode and set initial value if needed
  const switchToCustomMode = () => {
    setMode('custom');
    if (!selectedDateTime || selectedDateTime === 'never') {
      // Set default to 7 days from now if no custom value is set
      const defaultDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setSelectedDateTime(defaultDate.toISOString());
    }
  };

  // Get datetime-local value for input
  const getDateTimeLocalValue = (): string => {
    if (!selectedDateTime || selectedDateTime === 'never') return '';
    const date = getCurrentExpiryDate();
    return date ? formatDateTimeLocal(date) : '';
  };

  const minDateString = formatDateTimeLocal(minDate);
  const maxDateString = maxDate ? formatDateTimeLocal(maxDate) : undefined;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-1">
        <Label className="text-base font-medium">{title}</Label>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Mode Selection Buttons - only show if hints are available */}
      {hasHints && (
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <Button
            type="button"
            variant={mode === 'hints' ? 'outline' : 'ghost'}
            size="sm"
            onClick={() => setMode('hints')}
            className="flex-1"
          >
            <Clock className="h-4 w-4" />
            {quickSelectText}
          </Button>
          <Button
            type="button"
            variant={mode === 'custom' ? 'outline' : 'ghost'}
            size="sm"
            onClick={switchToCustomMode}
            className="flex-1 flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            {customDateText}
          </Button>
        </div>
      )}

      {/* Duration Selection Content */}
      {mode === 'hints' && hasHints ? (
        <div className="space-y-2">
          <Label htmlFor="duration-select" className="text-sm font-medium">
            {hintsLabel}
          </Label>
          <Select
            value={getHintValueFromSelection()}
            onValueChange={handleHintChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={hintsPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {hints.map(days => (
                <SelectItem key={days} value={days.toString()}>
                  {days === 1 ? '1 day' : `${days} days`}
                </SelectItem>
              ))}
              {neverExpiryAllowed && (
                <SelectItem value="never">{neverExpiresText}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="custom-datetime" className="text-sm font-medium">
            {customLabel}
          </Label>
          <Input
            id="custom-datetime"
            type="datetime-local"
            value={getDateTimeLocalValue()}
            min={minDateString}
            max={maxDateString}
            onChange={e => handleCustomDateTimeChange(e.target.value)}
            className="w-full"
          />
        </div>
      )}

      {/* Current Selection Display */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm font-medium text-blue-900">
          {currentSelectionPrefix}
        </div>
        <div className="text-sm text-blue-700">{getExpiryDisplayText()}</div>
      </div>

      {/* Never expires warning */}
      {selectedDateTime === 'never' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{neverExpiresWarningTitle}</AlertTitle>
          <AlertDescription>{neverExpiresWarningMessage}</AlertDescription>
        </Alert>
      )}

      {/* Maximum duration info */}
      {showMaxDurationInfo && maxDurationDays && (
        <div className="text-xs text-muted-foreground">
          {maximumDurationPrefix}: {maxDurationDays} days
        </div>
      )}
    </div>
  );
};
