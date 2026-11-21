import { useCallback, useEffect, useRef, useState } from "react";
import { USE_MOCK } from "../../services/admin/http";
import { getGpsConfig, sendGpsPoints } from "../../services/driver/portalService";

const MAX_BUFFER = 500;

// GPS sharing for the driver. See backend/docs/FRONTEND_INTEGRATION.md section 5:
//  * start only when config.canSend (confirmed assignment + tour ongoing), stop when it turns false or a send returns 409
//  * send at most every recommendedIntervalSeconds; keep points while offline and send them later in batches
//  * handle GeolocationPositionError codes 1 / 2 / 3
// The browser can only track while this page stays open (a native app is needed for background tracking).
export default function useGpsSharing() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [position, setPosition] = useState(null);
  const [simulated, setSimulated] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(null);
  const [sentCount, setSentCount] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [error, setError] = useState("");
  const [assignmentId, setAssignmentId] = useState(null);

  const r = useRef({ watch: null, timer: null, sim: null, latest: null, buffer: [], sending: false, wake: null, config: null, assignmentId: null, pauseUntil: 0 });

  const stop = useCallback((message = "") => {
    const s = r.current;
    if (s.watch != null) navigator.geolocation?.clearWatch(s.watch);
    clearInterval(s.timer); clearInterval(s.sim);
    s.watch = null; s.timer = null; s.sim = null;
    s.wake?.release?.().catch(() => {}); s.wake = null;
    setSharing(false); setSimulated(false);
    if (message) setError(message);
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const c = await getGpsConfig();
      r.current.config = c;
      setConfig(c); setConfigError("");
      setAssignmentId((current) => (c.assignments.some((a) => a.assignmentId === current) ? current : c.assignments[0]?.assignmentId ?? null));
      if (!c.canSend && r.current.timer) stop("Sharing stopped: the tour is no longer ongoing or the assignment is not confirmed.");
    } catch (e) {
      setConfigError(e?.response?.data?.message || "Could not check GPS availability.");
    } finally {
      setLoading(false);
    }
  }, [stop]);

  useEffect(() => {
    loadConfig();
    const poll = setInterval(loadConfig, 30000);
    return () => { clearInterval(poll); stop(); };
  }, [loadConfig, stop]);

  useEffect(() => { r.current.assignmentId = assignmentId; }, [assignmentId]);

  const sendNow = useCallback(async () => {
    const s = r.current;
    if (s.sending || !s.latest || s.latest.sent || Date.now() < s.pauseUntil) return;
    s.sending = true;
    const point = s.latest.point;
    s.latest.sent = true;
    const maxBatch = s.config?.maxPointsPerRequest || 100;
    try {
      while (s.buffer.length) {              // offline points first, in batches
        const batch = s.buffer.slice(0, maxBatch);
        await sendGpsPoints(batch, s.assignmentId);
        s.buffer.splice(0, batch.length);
        setSentCount((n) => n + batch.length);
        setBuffered(s.buffer.length);
      }
      await sendGpsPoints([point], s.assignmentId);
      setSentCount((n) => n + 1); setLastSentAt(new Date().toISOString()); setError("");
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409) stop(e.response.data?.message || "GPS is only accepted while the tour is ongoing.");
      else if (status === 401 || status === 403) stop("You are not allowed to send GPS right now. Please log in again.");
      else if (status === 429) { s.latest.sent = false; s.pauseUntil = Date.now() + (Number(e.response.data?.data?.retryAfterSeconds) || 10) * 1000; }
      else if (!e.response) {                // offline: keep the point, send it later
        s.buffer.push(point);
        if (s.buffer.length > MAX_BUFFER) s.buffer.shift();
        setBuffered(s.buffer.length); setError("No connection - points are saved and will be sent when you are back online.");
      } else setError(e.response.data?.message || "Could not send your location.");
    } finally {
      s.sending = false;
    }
  }, [stop]);

  const accept = useCallback((coords, timestamp) => {
    const point = {
      latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy ?? undefined,
      speed: coords.speed ?? undefined, heading: coords.heading ?? undefined, recordedAt: new Date(timestamp || Date.now()).toISOString(),
    };
    const first = !r.current.latest;
    r.current.latest = { point, sent: false };
    setPosition(point);
    if (first) sendNow();
  }, [sendNow]);

  const startSimulation = useCallback(() => {
    let lat = 6.9271; let lng = 79.8612;
    setSimulated(true);
    accept({ latitude: lat, longitude: lng, accuracy: 10, speed: 12, heading: 90 });
    r.current.sim = setInterval(() => {
      lat += (Math.random() - 0.3) * 0.0004; lng += Math.random() * 0.0005;
      accept({ latitude: lat, longitude: lng, accuracy: 10, speed: 12, heading: 90 });
    }, 3000);
  }, [accept]);

  const start = useCallback(async () => {
    const s = r.current;
    setError("");
    if (!s.config?.canSend) { setError("GPS sharing is only available for a confirmed assignment while the tour is ongoing."); return; }
    s.latest = null; s.pauseUntil = 0;

    const interval = Math.max(s.config.recommendedIntervalSeconds || 15, s.config.minIntervalSeconds || 5) * 1000;
    setSharing(true);
    s.timer = setInterval(sendNow, interval);
    try { s.wake = await navigator.wakeLock?.request("screen"); } catch { s.wake = null; } // keep the screen on

    if (!navigator.geolocation) {
      if (USE_MOCK) { startSimulation(); return; }
      stop("This browser does not support location sharing."); return;
    }
    s.watch = navigator.geolocation.watchPosition(
      (pos) => accept(pos.coords, pos.timestamp),
      (err) => {
        if (USE_MOCK) { navigator.geolocation.clearWatch(s.watch); s.watch = null; if (!s.sim) startSimulation(); return; }
        if (err.code === 1) stop("Location permission was denied. Allow location access for this site in your browser settings, then try again.");
        else setError(err.code === 3 ? "Getting your location timed out. Still trying…" : "Your location is unavailable right now. Still trying…");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }, [accept, sendNow, startSimulation, stop]);

  return { config, configError, loading, sharing, position, simulated, lastSentAt, sentCount, buffered, error, assignmentId, setAssignmentId, start, stop: () => stop(), reload: loadConfig };
}
