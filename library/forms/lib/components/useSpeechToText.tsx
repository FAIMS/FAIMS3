import {useState, useCallback, useEffect, useRef} from 'react';
import {SpeechRecognition} from '@capgo/capacitor-speech-recognition';
import type {PluginListenerHandle} from '@capacitor/core';

/**
 * Speech recognition status states
 */
export type SpeechStatus =
  | 'idle'
  | 'initializing'
  | 'listening'
  | 'processing'
  | 'error'
  | 'unavailable'
  | 'permission-denied';

/**
 * Configuration options for speech recognition
 */
export interface SpeechToTextOptions {
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Language locale (e.g., 'en-US', 'en-AU') */
  language?: string;
  /** Maximum number of alternative results */
  maxResults?: number;
  /** Whether to stream partial results */
  partialResults?: boolean;
  /** Add punctuation (iOS 16+ only) */
  addPunctuation?: boolean;
  /** Silence timeout in ms (Android only) */
  allowForSilence?: number;
  /** Whether to append to existing text or replace */
  appendMode?: boolean;
  /** Enable detailed console logging for debugging */
  debugMode?: boolean;
  /** Delay in ms to wait for final results after recognition stops (default: 150) */
  finalizeDelay?: number;
  /** Callback when final result is received */
  onResult?: (text: string) => void;
  /** Callback for partial results */
  onPartialResult?: (text: string) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Callback when status changes */
  onStatusChange?: (status: SpeechStatus) => void;
}

/**
 * Return type for the useSpeechToText hook
 */
export interface SpeechToTextResult {
  /** Current transcribed text */
  transcript: string;
  /** Partial/interim transcription while speaking */
  interimTranscript: string;
  /** Current status of speech recognition */
  status: SpeechStatus;
  /** Whether currently listening */
  isListening: boolean;
  /** Whether speech recognition is available on device */
  isAvailable: boolean;
  /** Whether permission has been granted */
  hasPermission: boolean;
  /** Any error that occurred */
  error: Error | null;
  /** Start listening for speech */
  startListening: () => Promise<void>;
  /** Stop listening */
  stopListening: () => Promise<void>;
  /** Toggle listening state */
  toggleListening: () => Promise<void>;
  /** Clear the transcript */
  clearTranscript: () => void;
  /** Set the transcript manually */
  setTranscript: (text: string) => void;
  /** Request permissions */
  requestPermission: () => Promise<boolean>;
  /** Check current permission status */
  checkPermission: () => Promise<boolean>;
  /** Get supported languages */
  getSupportedLanguages: () => Promise<string[]>;
}

/**
 * Default options for speech recognition
 */
const DEFAULT_OPTIONS = {
  enabled: true,
  language: 'en-AU',
  maxResults: 3,
  partialResults: true,
  addPunctuation: true,
  allowForSilence: 4000,
  appendMode: false,
  debugMode: false,
  finalizeDelay: 150,
};

/**
 * Disabled/stub result returned when hook is not enabled
 */
const DISABLED_RESULT: SpeechToTextResult = {
  transcript: '',
  interimTranscript: '',
  status: 'unavailable',
  isListening: false,
  isAvailable: false,
  hasPermission: false,
  error: null,
  startListening: async () => {},
  stopListening: async () => {},
  toggleListening: async () => {},
  clearTranscript: () => {},
  setTranscript: () => {},
  requestPermission: async () => false,
  checkPermission: async () => false,
  getSupportedLanguages: async () => [],
};

/**
 * Custom hook for speech-to-text functionality using Capacitor Speech Recognition.
 *
 * @example
 * ```tsx
 * const {
 *   transcript,
 *   isListening,
 *   startListening,
 *   stopListening,
 *   toggleListening,
 * } = useSpeechToText({
 *   enabled: true,
 *   language: 'en-US',
 *   debugMode: true,
 *   onResult: (text) => form.setValue('fieldName', text),
 * });
 * ```
 */
export function useSpeechToText(
  options: SpeechToTextOptions = {}
): SpeechToTextResult {
  const mergedOptions = {...DEFAULT_OPTIONS, ...options};
  const isEnabled = mergedOptions.enabled;

  // Instance ID for debugging multiple hook instances
  const instanceId = useRef(Math.random().toString(36).substring(2, 9));

  /**
   * Debug logger - only logs when debugMode is enabled
   */
  const debug = useCallback(
    (message: string, data?: unknown) => {
      if (mergedOptions.debugMode) {
        const timestamp = new Date().toISOString().substr(11, 12);
        const prefix = `[SpeechToText:${instanceId.current} ${timestamp}]`;
        if (data !== undefined) {
          console.log(`${prefix} ${message}`, data);
        } else {
          console.log(`${prefix} ${message}`);
        }
      }
    },
    [mergedOptions.debugMode]
  );

  // State
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for listeners and state tracking
  const partialListenerRef = useRef<PluginListenerHandle | null>(null);
  const stateListenerRef = useRef<PluginListenerHandle | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const baseTranscriptRef = useRef<string>('');
  const interimTranscriptRef = useRef<string>('');
  const finalizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep interimTranscriptRef in sync with state
  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  // Derived state
  const isListening = status === 'listening';

  // Store options in ref to avoid stale closures in listeners
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const mergedOptionsRef = useRef(mergedOptions);
  useEffect(() => {
    mergedOptionsRef.current = mergedOptions;
  }, [mergedOptions]);

  /**
   * Update status and notify callback
   */
  const updateStatus = useCallback(
    (newStatus: SpeechStatus) => {
      setStatus(prevStatus => {
        debug(`Status change: ${prevStatus} → ${newStatus}`);
        return newStatus;
      });
      optionsRef.current.onStatusChange?.(newStatus);
    },
    [debug]
  );

  /**
   * Handle errors
   */
  const handleError = useCallback(
    (err: Error) => {
      debug(`Error occurred: ${err.message}`, {
        name: err.name,
        stack: err.stack,
      });
      setError(err);
      updateStatus('error');
      optionsRef.current.onError?.(err);
    },
    [debug, updateStatus]
  );

  /**
   * Check if speech recognition is available
   */
  const checkAvailability = useCallback(async (): Promise<boolean> => {
    debug('Checking availability...');
    try {
      const {available} = await SpeechRecognition.available();
      debug(`Availability result: ${available}`);
      setIsAvailable(available);
      if (!available) {
        updateStatus('unavailable');
      }
      return available;
    } catch (err) {
      debug('Availability check failed', err);
      console.warn('Failed to check speech recognition availability:', err);
      setIsAvailable(false);
      return false;
    }
  }, [debug, updateStatus]);

  /**
   * Check current permission status
   */
  const checkPermission = useCallback(async (): Promise<boolean> => {
    debug('Checking permissions...');
    try {
      const result = await SpeechRecognition.checkPermissions();
      debug('Permission check result', result);
      const granted = result.speechRecognition === 'granted';
      setHasPermission(granted);
      return granted;
    } catch (err) {
      debug('Permission check failed', err);
      console.warn('Failed to check permissions:', err);
      return false;
    }
  }, [debug]);

  /**
   * Request speech recognition permissions
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    debug('Requesting permissions...');
    try {
      const result = await SpeechRecognition.requestPermissions();
      debug('Permission request result', result);
      const granted = result.speechRecognition === 'granted';
      setHasPermission(granted);
      if (!granted) {
        updateStatus('permission-denied');
      }
      return granted;
    } catch (err) {
      debug('Permission request failed', err);
      handleError(
        err instanceof Error ? err : new Error('Failed to request permissions')
      );
      return false;
    }
  }, [debug, handleError, updateStatus]);

  /**
   * Clear any pending finalize timeout
   */
  const clearFinalizeTimeout = useCallback(() => {
    if (finalizeTimeoutRef.current) {
      clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
  }, []);

  /**
   * Clean up listeners
   */
  const cleanupListeners = useCallback(async () => {
    debug('Cleaning up listeners...', {
      hasPartialListener: !!partialListenerRef.current,
      hasStateListener: !!stateListenerRef.current,
    });
    clearFinalizeTimeout();
    if (partialListenerRef.current) {
      await partialListenerRef.current.remove();
      partialListenerRef.current = null;
      debug('Partial results listener removed');
    }
    if (stateListenerRef.current) {
      await stateListenerRef.current.remove();
      stateListenerRef.current = null;
      debug('State listener removed');
    }
  }, [debug, clearFinalizeTimeout]);

  /**
   * Finalize the transcript - save interim results and reset state
   */
  const finalizeTranscript = useCallback(() => {
    const finalInterim = interimTranscriptRef.current;
    debug('Finalizing transcript', {
      finalInterim,
      baseTranscript: baseTranscriptRef.current,
      appendMode: mergedOptionsRef.current.appendMode,
    });

    if (finalInterim) {
      const newTranscript = mergedOptionsRef.current.appendMode
        ? `${baseTranscriptRef.current} ${finalInterim}`.trim()
        : finalInterim;

      debug(`Setting final transcript: "${newTranscript}"`);
      setTranscript(newTranscript);
      setInterimTranscript('');
      optionsRef.current.onResult?.(newTranscript);
    } else {
      debug('No interim transcript to finalize');
      setInterimTranscript('');
    }

    updateStatus('idle');
  }, [debug, updateStatus]);

  /**
   * Start listening for speech
   */
  const startListening = useCallback(async (): Promise<void> => {
    debug('startListening called', {
      isListeningRef: isListeningRef.current,
      currentStatus: status,
    });

    if (isListeningRef.current) {
      debug('Already listening - ignoring startListening call');
      console.warn('Already listening');
      return;
    }

    // Clear any pending finalize from previous session
    clearFinalizeTimeout();
    setError(null);
    updateStatus('initializing');

    try {
      // Check availability
      debug('Step 1: Checking availability');
      const available = await checkAvailability();
      if (!available) {
        throw new Error('Speech recognition is not available on this device');
      }

      // Check/request permissions
      debug('Step 2: Checking permissions');
      let permitted = await checkPermission();
      if (!permitted) {
        debug('Permission not granted, requesting...');
        permitted = await requestPermission();
        if (!permitted) {
          throw new Error('Speech recognition permission denied');
        }
      }

      // Store current transcript as base for append mode
      debug('Step 3: Setting up transcript base', {
        appendMode: mergedOptions.appendMode,
        currentTranscript: transcript,
      });
      if (mergedOptions.appendMode) {
        baseTranscriptRef.current = transcript;
      } else {
        baseTranscriptRef.current = '';
      }

      // Reset interim transcript
      setInterimTranscript('');
      interimTranscriptRef.current = '';

      // Set up partial results listener
      debug('Step 4: Setting up partialResults listener');
      partialListenerRef.current = await SpeechRecognition.addListener(
        'partialResults',
        event => {
          debug('partialResults event received', event);
          const partialText = event.matches?.[0] || '';
          debug(`Setting interim transcript: "${partialText}"`);
          setInterimTranscript(partialText);
          interimTranscriptRef.current = partialText;
          optionsRef.current.onPartialResult?.(partialText);
        }
      );
      debug('partialResults listener attached');

      // Set up listening state listener
      debug('Step 5: Setting up listeningState listener');
      stateListenerRef.current = await SpeechRecognition.addListener(
        'listeningState',
        event => {
          debug('listeningState event received', {
            event,
            isListeningRef: isListeningRef.current,
            currentInterim: interimTranscriptRef.current,
          });

          if (event.status === 'stopped' && isListeningRef.current) {
            debug('Recognition stopped via listeningState event');
            isListeningRef.current = false;

            // Use a delay to allow any final partialResults to arrive
            // before finalizing the transcript
            clearFinalizeTimeout();
            finalizeTimeoutRef.current = setTimeout(() => {
              // Only finalize if we haven't restarted listening
              if (!isListeningRef.current) {
                debug('Finalize timeout triggered');
                finalizeTranscript();
                cleanupListeners();
              }
            }, mergedOptionsRef.current.finalizeDelay);
          }
        }
      );
      debug('listeningState listener attached');

      // Start recognition
      debug('Step 6: Starting recognition with options', {
        language: mergedOptions.language,
        maxResults: mergedOptions.maxResults,
        partialResults: mergedOptions.partialResults,
        addPunctuation: mergedOptions.addPunctuation,
        allowForSilence: mergedOptions.allowForSilence,
        popup: false,
      });

      const result = await SpeechRecognition.start({
        language: mergedOptions.language,
        maxResults: mergedOptions.maxResults,
        partialResults: mergedOptions.partialResults,
        addPunctuation: mergedOptions.addPunctuation,
        allowForSilence: mergedOptions.allowForSilence,
        popup: false,
      });

      debug('SpeechRecognition.start() returned', result);

      isListeningRef.current = true;
      updateStatus('listening');
      debug('Now listening - isListeningRef set to true');

      // Handle immediate result (only when partialResults is false)
      // When partialResults is true, results come via the listener
      if (result?.matches && result.matches.length > 0) {
        debug('Immediate result received', {matches: result.matches});
        const finalText = result.matches[0];
        const newTranscript = mergedOptions.appendMode
          ? `${baseTranscriptRef.current} ${finalText}`.trim()
          : finalText;

        debug(`Setting final transcript: "${newTranscript}"`);
        setTranscript(newTranscript);
        setInterimTranscript('');
        optionsRef.current.onResult?.(newTranscript);
      }
    } catch (err) {
      debug('startListening caught error', err);
      await cleanupListeners();
      isListeningRef.current = false;
      handleError(
        err instanceof Error ? err : new Error('Failed to start listening')
      );
    }
  }, [
    checkAvailability,
    checkPermission,
    cleanupListeners,
    clearFinalizeTimeout,
    debug,
    finalizeTranscript,
    handleError,
    mergedOptions,
    requestPermission,
    status,
    transcript,
    updateStatus,
  ]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(async (): Promise<void> => {
    debug('stopListening called', {
      isListeningRef: isListeningRef.current,
      currentStatus: status,
      interimTranscript: interimTranscriptRef.current,
    });

    if (!isListeningRef.current) {
      debug('Not currently listening - ignoring stopListening call');
      return;
    }

    updateStatus('processing');
    isListeningRef.current = false;

    try {
      debug('Calling SpeechRecognition.stop()');
      await SpeechRecognition.stop();
      debug('SpeechRecognition.stop() completed');

      // Clear any pending finalize timeout since we're manually stopping
      clearFinalizeTimeout();

      // Small delay to allow final results to arrive
      await new Promise(resolve =>
        setTimeout(resolve, mergedOptions.finalizeDelay)
      );

      // Finalize transcript
      finalizeTranscript();
      await cleanupListeners();
      debug('stopListening completed successfully');
    } catch (err) {
      debug('stopListening caught error', err);
      await cleanupListeners();
      handleError(
        err instanceof Error ? err : new Error('Failed to stop listening')
      );
    }
  }, [
    cleanupListeners,
    clearFinalizeTimeout,
    debug,
    finalizeTranscript,
    handleError,
    mergedOptions.finalizeDelay,
    status,
    updateStatus,
  ]);

  /**
   * Toggle listening state
   */
  const toggleListening = useCallback(async (): Promise<void> => {
    debug('toggleListening called', {
      isListeningRef: isListeningRef.current,
    });
    if (isListeningRef.current) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [debug, startListening, stopListening]);

  /**
   * Clear the transcript
   */
  const clearTranscript = useCallback(() => {
    debug('Clearing transcript');
    setTranscript('');
    setInterimTranscript('');
    interimTranscriptRef.current = '';
    baseTranscriptRef.current = '';
  }, [debug]);

  /**
   * Set transcript manually
   */
  const setTranscriptManually = useCallback(
    (text: string) => {
      debug(`Setting transcript manually: "${text}"`);
      setTranscript(text);
    },
    [debug]
  );

  /**
   * Get supported languages
   */
  const getSupportedLanguages = useCallback(async (): Promise<string[]> => {
    debug('Getting supported languages');
    try {
      const {languages} = await SpeechRecognition.getSupportedLanguages();
      debug('Supported languages', languages);
      return languages;
    } catch (err) {
      debug('Failed to get supported languages', err);
      console.warn('Failed to get supported languages:', err);
      return [];
    }
  }, [debug]);

  // Initialize on mount - only if enabled
  useEffect(() => {
    if (!isEnabled) {
      debug('Hook disabled - skipping initialization');
      return;
    }
    debug('Hook mounted - initializing');
    checkAvailability();
    checkPermission();
  }, [isEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debug('Hook unmounting - cleaning up');
      clearFinalizeTimeout();
      if (isListeningRef.current) {
        SpeechRecognition.stop().catch(console.warn);
      }
      // Note: cleanupListeners is async but we can't await in cleanup
      // The listeners will be garbage collected anyway
      if (partialListenerRef.current) {
        partialListenerRef.current.remove().catch(console.warn);
      }
      if (stateListenerRef.current) {
        stateListenerRef.current.remove().catch(console.warn);
      }
    };
  }, []);

  // Return disabled stub if not enabled
  if (!isEnabled) {
    return DISABLED_RESULT;
  }

  return {
    transcript,
    interimTranscript,
    status,
    isListening,
    isAvailable,
    hasPermission,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    setTranscript: setTranscriptManually,
    requestPermission,
    checkPermission,
    getSupportedLanguages,
  };
}

export default useSpeechToText;
