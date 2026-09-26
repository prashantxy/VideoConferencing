'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type MediaError = 'denied' | 'system-blocked' | 'not-found' | 'unknown';

const PERMISSIONS = ['camera', 'microphone'] as PermissionName[];

/** Current site permission for camera + mic, or null where the browser can't say (e.g. Firefox). */
async function queryPermissions(): Promise<PermissionStatus[] | null> {
  try {
    return await Promise.all(PERMISSIONS.map((name) => navigator.permissions.query({ name })));
  } catch {
    return null;
  }
}

/**
 * Opens the camera and microphone for the lifetime of the component and stops
 * every track on unmount. `retry` asks the browser again after a failure.
 *
 * Once the user clicks Block, browsers reject getUserMedia without prompting and
 * no page can re-open the prompt. So while blocked we watch the permission and
 * retry by ourselves as soon as the user allows it from the address bar.
 */
export function useLocalMedia(initial: { audio: boolean; video: boolean } = { audio: true, video: true }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<MediaError | null>(null);
  const [audioOn, setAudioOn] = useState(initial.audio);
  const [videoOn, setVideoOn] = useState(initial.video);
  const [attempt, setAttempt] = useState(0);
  const initialRef = useRef(initial);

  useEffect(() => {
    let cancelled = false;
    let acquired: MediaStream | null = null;
    setError(null);

    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        acquired = s;
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        s.getAudioTracks().forEach((t) => (t.enabled = initialRef.current.audio));
        s.getVideoTracks().forEach((t) => (t.enabled = initialRef.current.video));
        setStream(s);
      })
      .catch(async (err: DOMException) => {
        if (cancelled) return;
        if (err.name === 'NotFoundError') return setError('not-found');
        if (err.name !== 'NotAllowedError') return setError('unknown');
        // Site allowed but still refused: the OS (e.g. macOS Privacy settings) is blocking the browser.
        const statuses = await queryPermissions();
        if (cancelled) return;
        setError(statuses?.every((p) => p.state === 'granted') ? 'system-blocked' : 'denied');
      });

    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // While blocked: retry when the permission flips away from "denied", or when the
  // user comes back to the tab (after changing site or system settings).
  useEffect(() => {
    if (error !== 'denied' && error !== 'system-blocked') return;
    let statuses: PermissionStatus[] | null = null;
    let active = true;

    // Without the Permissions API we can't tell, and retrying would just fail again.
    const retryIfUnblocked = () => {
      if (statuses?.every((p) => p.state !== 'denied')) retry();
    };
    const onChange = retryIfUnblocked;
    const onReturn = () => {
      if (document.visibilityState === 'visible') retryIfUnblocked();
    };

    queryPermissions().then((s) => {
      if (!active || !s) return;
      statuses = s;
      s.forEach((p) => p.addEventListener('change', onChange));
    });
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      active = false;
      statuses?.forEach((p) => p.removeEventListener('change', onChange));
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [error, retry]);

  const toggleAudio = useCallback(() => {
    setAudioOn((on) => {
      stream?.getAudioTracks().forEach((t) => (t.enabled = !on));
      return !on;
    });
  }, [stream]);

  const toggleVideo = useCallback(() => {
    setVideoOn((on) => {
      stream?.getVideoTracks().forEach((t) => (t.enabled = !on));
      return !on;
    });
  }, [stream]);

  return { stream, error, audioOn, videoOn, toggleAudio, toggleVideo, retry };
}

export const mediaErrorText: Record<MediaError, string> = {
  denied: 'Camera and mic are blocked for this site. Click the camera icon (or the lock) in the address bar and choose Allow. We’ll reconnect automatically.',
  'system-blocked': 'Your computer is blocking the camera for this browser. Turn it on in System Settings → Privacy & Security → Camera (and Microphone), then restart the browser.',
  'not-found': 'No camera or microphone was found on this device.',
  unknown: 'Could not start your camera. Is another app using it?',
};
