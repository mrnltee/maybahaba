import { useCallback, useState } from "react";

interface GeolocationState {
  loading: boolean;
  error: string | null;
}

/**
 * One-shot browser geolocation request (spec section 33). Never watches
 * position continuously — only called when the user explicitly taps
 * "Use my location".
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ loading: false, error: null });

  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    setState({ loading: true, error: null });
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        const message = "Hindi supported ang location sa browser mo.";
        setState({ loading: false, error: message });
        reject(new Error(message));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState({ loading: false, error: null });
          resolve(position);
        },
        () => {
          const message = "Hindi namin makuha ang location mo. Maaari kang mag-search manually.";
          setState({ loading: false, error: message });
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, []);

  return { ...state, getCurrentPosition };
}
