'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type MediaError = 'denied' | 'not-found' | 'unknown';

/**
 * Opens the camera and microphone for the lifetime of the component and stops
 * every track on unmount. `retry` asks the browser again after a failure.
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
      .catch((err: DOMException) => {
        if (cancelled) return;
        setError(err.name === 'NotAllowedError' ? 'denied' : err.name === 'NotFoundError' ? 'not-found' : 'unknown');
      });

    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [attempt]);

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

  return { stream, error, audioOn, videoOn, toggleAudio, toggleVideo, retry: () => setAttempt((n) => n + 1) };
}

export const mediaErrorText: Record<MediaError, string> = {
  denied: 'Camera access was blocked. Allow it from the address bar, then try again.',
  'not-found': 'No camera or microphone was found on this device.',
  unknown: 'Could not start your camera. Is another app using it?',
};
