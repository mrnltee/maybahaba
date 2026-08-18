"use client";

import { useCallback, useState } from "react";

export interface DeviceLocation {
  latitude: number;
  longitude: number;
}

interface State {
  location: DeviceLocation | null;
  loading: boolean;
  error: string | null;
}

/**
 * The user's location, requested only on explicit action.
 *
 * Deliberately NOT requested on page load. Prompting for location the
 * moment someone arrives is the pattern most people decline, and a
 * declined permission is sticky — you don't get a second chance in that
 * browser. Since distances are a convenience and search works without
 * them, the prompt waits until the user taps something that needs it
 * (spec section 33: request only when necessary, never track continuously).
 */
export function useDeviceLocation() {
  const [state, setState] = useState<State>({ location: null, loading: false, error: null });

  const request = useCallback(async (): Promise<DeviceLocation | null> => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState((s) => ({ ...s, error: "Hindi supported ang location sa browser mo." }));
      return null;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setState({ location, loading: false, error: null });
          resolve(location);
        },
        () => {
          setState({
            location: null,
            loading: false,
            error: "Hindi namin makuha ang location mo. Maaari kang mag-search manually.",
          });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, []);

  const clear = useCallback(() => {
    setState({ location: null, loading: false, error: null });
  }, []);

  return { ...state, request, clear };
}
