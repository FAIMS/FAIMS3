import {View} from 'ol';
import {Control} from 'ol/control';
import src from '../icons/pin.svg';
import {CreateDomIcon} from '../dom-icon';

/**
 * Configuration options for the UseCurrentLocation control
 */
export interface UseCurrentLocationOptions {
  /** The map view instance */
  view: View;
  /** Callback fired when the button is clicked */
  onClick: () => void;
  /** Whether location is currently available */
  isLocationAvailable?: boolean;
}

/**
 * Creates a custom control button that emits the current location for use in
 * upstream components.
 *
 * Features:
 * - Disabled until location becomes available
 * - Listens for location availability changes via custom events
 *
 * @param options - Configuration options
 * @returns The custom control instance
 */
export const createUseCurrentLocationControl = ({
  view,
  onClick,
  isLocationAvailable = false,
}: UseCurrentLocationOptions): Control => {
  // State
  let locationAvailable = isLocationAvailable;

  // Create button element
  const button = document.createElement('button');
  button.className = 'ol-custom-control-button';
  button.setAttribute('type', 'button');
  button.title = 'Use current location';
  button.appendChild(
    CreateDomIcon({
      src,
      width: 24,
      height: 24,
      alt: 'Use current location',
    })
  );

  /**
   * Updates the button's visual state to reflect current conditions
   */
  const updateButtonState = (): void => {
    button.disabled = !locationAvailable;
  };

  /**
   * Handles button clicks
   */
  const handleClick = (): void => {
    if (!locationAvailable) {
      console.warn('Current location is not available');
      return;
    }
    onClick();
  };

  /**
   * Handles location availability changes
   */
  const handleLocationAvailabilityChange = (
    event: CustomEvent<{isAvailable: boolean}>
  ): void => {
    locationAvailable = event.detail.isAvailable;
    updateButtonState();
  };

  // Set up event listeners
  button.addEventListener('click', handleClick);
  window.addEventListener(
    'map-location-availability-change',
    handleLocationAvailabilityChange as EventListener
  );

  // Create container element
  const element = document.createElement('div');
  element.className = 'ol-custom-control ol-current-location-box';
  element.appendChild(button);

  // Apply initial state
  updateButtonState();

  return new Control({element});
};
