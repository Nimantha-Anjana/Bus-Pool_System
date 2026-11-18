import { useEffect, useState } from "react";
import { getErrorMessage } from "../../services/admin/http";

// Runs an async loader, tracks loading / error, and re-runs when deps change or reload() is called.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    loader()
      .then((data) => !cancelled && setState({ data, loading: false, error: "" }))
      .catch((error) => !cancelled && setState((s) => ({ ...s, loading: false, error: getErrorMessage(error) })));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, setData: (data) => setState((s) => ({ ...s, data })), reload: () => setTick((t) => t + 1) };
}
