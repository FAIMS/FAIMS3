// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   useDeviceHeading: web DeviceOrientation path and native Capgo startup.
 *   Mocks are vi.hoisted so the vi.mock factories can close over them.
 */

import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'web'),
  addListener: vi.fn(),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {getPlatform: () => mocks.getPlatform()},
}));

vi.mock('@capgo/capacitor-compass', () => ({
  CapgoCompass: {
    addListener: mocks.addListener,
    startListening: mocks.startListening,
    stopListening: mocks.stopListening,
    checkPermissions: mocks.checkPermissions,
    requestPermissions: mocks.requestPermissions,
  },
}));

vi.mock('../logging', () => ({
  logWarn: (...args: unknown[]) => mocks.logWarn(...args),
}));

import {resetNativeCompassForTests, useDeviceHeading} from './useDeviceHeading';

type HeadingChange = (event: {value: number}) => void;

async function flushNativeStart() {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
}

function mockGrantedNativeListener() {
  const listener: {current?: HeadingChange} = {};
  const remove = vi.fn().mockResolvedValue(undefined);
  mocks.checkPermissions.mockResolvedValue({compass: 'granted'});
  mocks.addListener.mockImplementation(
    async (_event: string, cb: HeadingChange) => {
      listener.current = cb;
      return {remove};
    }
  );
  mocks.startListening.mockResolvedValue(undefined);
  mocks.stopListening.mockResolvedValue(undefined);
  return {listener, remove};
}

describe('useDeviceHeading', () => {
  const originalDeviceOrientationEvent = window.DeviceOrientationEvent;

  beforeEach(() => {
    mocks.getPlatform.mockReturnValue('web');
    mocks.addListener.mockReset();
    mocks.startListening.mockReset();
    mocks.stopListening.mockReset();
    mocks.checkPermissions.mockReset();
    mocks.requestPermissions.mockReset();
    mocks.logWarn.mockReset();
  });

  afterEach(() => {
    window.DeviceOrientationEvent = originalDeviceOrientationEvent;
    resetNativeCompassForTests();
    vi.restoreAllMocks();
  });

  it('reads webkitCompassHeading from deviceorientation', () => {
    const {result} = renderHook(() => useDeviceHeading());

    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('deviceorientation'), {
          webkitCompassHeading: 123,
          alpha: 10,
          absolute: true,
        })
      );
    });

    expect(result.current.headingDeg).toBe(123);
    expect(result.current.source).toBe('compass');
    expect(result.current.reference).toBe('magnetic');
    expect(mocks.startListening).not.toHaveBeenCalled();
  });

  it('starts Capgo on native platforms', async () => {
    mocks.getPlatform.mockReturnValue('android');
    mockGrantedNativeListener();

    renderHook(() => useDeviceHeading());
    await flushNativeStart();

    expect(mocks.checkPermissions).toHaveBeenCalled();
    expect(mocks.addListener).toHaveBeenCalledWith(
      'headingChange',
      expect.any(Function)
    );
    expect(mocks.startListening).toHaveBeenCalled();
  });

  it('prompts for native permission when the plugin reports prompt', async () => {
    mocks.getPlatform.mockReturnValue('android');
    const {listener} = mockGrantedNativeListener();
    mocks.checkPermissions.mockResolvedValue({compass: 'prompt'});
    mocks.requestPermissions.mockResolvedValue({compass: 'granted'});

    const {result} = renderHook(() => useDeviceHeading());
    await flushNativeStart();

    expect(mocks.requestPermissions).toHaveBeenCalled();
    expect(mocks.startListening).toHaveBeenCalled();

    act(() => {
      listener.current?.({value: 40});
    });
    expect(result.current.headingDeg).toBe(40);
  });

  it('prompts with rationale the same way as prompt', async () => {
    mocks.getPlatform.mockReturnValue('ios');
    mockGrantedNativeListener();
    mocks.checkPermissions.mockResolvedValue({
      compass: 'prompt-with-rationale',
    });
    mocks.requestPermissions.mockResolvedValue({compass: 'granted'});

    renderHook(() => useDeviceHeading());
    await flushNativeStart();

    expect(mocks.requestPermissions).toHaveBeenCalled();
    expect(mocks.startListening).toHaveBeenCalled();
  });

  it('does not start listening when native permission is denied', async () => {
    mocks.getPlatform.mockReturnValue('ios');
    mocks.checkPermissions.mockResolvedValue({compass: 'denied'});

    const {result} = renderHook(() => useDeviceHeading());
    await flushNativeStart();

    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.addListener).not.toHaveBeenCalled();
    expect(mocks.startListening).not.toHaveBeenCalled();
    expect(result.current.headingDeg).toBeNull();
  });

  it('does not start listening when a permission prompt is refused', async () => {
    mocks.getPlatform.mockReturnValue('android');
    mocks.checkPermissions.mockResolvedValue({compass: 'prompt'});
    mocks.requestPermissions.mockResolvedValue({compass: 'denied'});

    renderHook(() => useDeviceHeading());
    await flushNativeStart();

    expect(mocks.addListener).not.toHaveBeenCalled();
    expect(mocks.startListening).not.toHaveBeenCalled();
  });

  it('logs and continues when native start throws', async () => {
    mocks.getPlatform.mockReturnValue('android');
    mocks.checkPermissions.mockRejectedValue(new Error('no sensor'));

    renderHook(() => useDeviceHeading());
    await flushNativeStart();

    expect(mocks.logWarn).toHaveBeenCalledWith(
      'Failed to start native compass:',
      expect.any(Error)
    );
    expect(mocks.startListening).not.toHaveBeenCalled();
  });

  it('logs when native stop throws on unmount', async () => {
    mocks.getPlatform.mockReturnValue('android');
    mockGrantedNativeListener();
    mocks.stopListening.mockRejectedValue(new Error('already stopped'));

    const {unmount} = renderHook(() => useDeviceHeading());
    await flushNativeStart();

    unmount();

    await waitFor(() => {
      expect(mocks.logWarn).toHaveBeenCalledWith(
        'Failed to stop native compass:',
        expect.any(Error)
      );
    });
  });

  it('applies a native headingChange on Android as magnetic', async () => {
    mocks.getPlatform.mockReturnValue('android');
    const {listener} = mockGrantedNativeListener();

    const {result} = renderHook(() => useDeviceHeading());
    await flushNativeStart();

    act(() => {
      listener.current?.({value: 77});
    });

    expect(result.current.headingDeg).toBe(77);
    expect(result.current.source).toBe('compass');
    expect(result.current.reference).toBe('magnetic');
  });

  it('labels an iOS headingChange as true north', async () => {
    mocks.getPlatform.mockReturnValue('ios');
    const {listener} = mockGrantedNativeListener();

    const {result} = renderHook(() => useDeviceHeading());
    await flushNativeStart();

    act(() => {
      listener.current?.({value: 12});
    });

    expect(result.current.headingDeg).toBe(12);
    expect(result.current.source).toBe('compass');
    expect(result.current.reference).toBe('true');
  });

  it('ignores a non-finite native headingChange', async () => {
    mocks.getPlatform.mockReturnValue('android');
    const {listener} = mockGrantedNativeListener();

    const {result} = renderHook(() => useDeviceHeading());
    await flushNativeStart();

    act(() => {
      listener.current?.({value: Number.NaN});
    });

    expect(result.current.headingDeg).toBeNull();
    expect(result.current.reference).toBeNull();
  });

  it('ignores a native headingChange of -1', async () => {
    mocks.getPlatform.mockReturnValue('android');
    const {listener} = mockGrantedNativeListener();

    const {result} = renderHook(() => useDeviceHeading());
    await flushNativeStart();

    act(() => {
      listener.current?.({value: -1});
    });

    expect(result.current.headingDeg).toBeNull();
  });

  it('stops the native session if the map unmounts while startListening is pending', async () => {
    mocks.getPlatform.mockReturnValue('android');
    let resolveStart: (() => void) | undefined;
    const startPending = new Promise<void>(resolve => {
      resolveStart = resolve;
    });
    mockGrantedNativeListener();
    mocks.startListening.mockReturnValue(startPending);

    const {unmount} = renderHook(() => useDeviceHeading());
    unmount();

    await act(async () => {
      resolveStart?.();
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });

    await waitFor(() => {
      expect(mocks.stopListening).toHaveBeenCalledTimes(1);
    });
  });

  it('shares one native session across two maps', async () => {
    mocks.getPlatform.mockReturnValue('android');
    const {listener} = mockGrantedNativeListener();

    const first = renderHook(() => useDeviceHeading());
    const second = renderHook(() => useDeviceHeading());
    await flushNativeStart();

    expect(mocks.startListening).toHaveBeenCalledTimes(1);

    act(() => {
      listener.current?.({value: 88});
    });
    expect(first.result.current.headingDeg).toBe(88);
    expect(second.result.current.headingDeg).toBe(88);

    first.unmount();
    await flushNativeStart();
    expect(mocks.stopListening).not.toHaveBeenCalled();

    second.unmount();
    await waitFor(() => {
      expect(mocks.stopListening).toHaveBeenCalledTimes(1);
    });
  });

  it('ignores web orientation without an absolute compass reading', () => {
    const {result} = renderHook(() => useDeviceHeading());

    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('deviceorientation'), {
          alpha: 90,
        })
      );
    });

    expect(result.current.headingDeg).toBeNull();
  });

  it('requests web orientation permission once from a user gesture', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      writable: true,
      value: {requestPermission},
    });

    const {result} = renderHook(() => useDeviceHeading());

    act(() => {
      result.current.requestWebPermission();
      result.current.requestWebPermission();
    });

    await waitFor(() => {
      expect(requestPermission).toHaveBeenCalledTimes(1);
    });
    expect(mocks.logWarn).not.toHaveBeenCalled();
  });

  it('warns when web orientation permission is refused', async () => {
    const requestPermission = vi.fn().mockResolvedValue('denied');
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      writable: true,
      value: {requestPermission},
    });

    const {result} = renderHook(() => useDeviceHeading());

    act(() => {
      result.current.requestWebPermission();
    });

    await waitFor(() => {
      expect(mocks.logWarn).toHaveBeenCalledWith(
        'Device orientation permission was not granted'
      );
    });
  });

  it('warns when web orientation permission throws', async () => {
    const requestPermission = vi
      .fn()
      .mockRejectedValue(new Error('must be a gesture'));
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      writable: true,
      value: {requestPermission},
    });

    const {result} = renderHook(() => useDeviceHeading());

    act(() => {
      result.current.requestWebPermission();
    });

    await waitFor(() => {
      expect(mocks.logWarn).toHaveBeenCalledWith(
        'Failed to request device orientation permission:',
        expect.any(Error)
      );
    });
  });

  it('does not request web permission on native platforms', () => {
    mocks.getPlatform.mockReturnValue('ios');
    mockGrantedNativeListener();
    const requestPermission = vi.fn();
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      writable: true,
      value: {requestPermission},
    });

    const {result} = renderHook(() => useDeviceHeading());

    act(() => {
      result.current.requestWebPermission();
    });

    expect(requestPermission).not.toHaveBeenCalled();
  });
});
