import { useState, useRef, useCallback } from 'react';

/**
 * MediaRecorder with 30s timeslice. Exposes flushChunk() to request an early blob
 * (manual refresh → transcribe → suggestions).
 */
export function useAudioRecorder(onChunkReady) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const flushWaiterRef = useRef(null);
  const manualFlushPendingRef = useRef(false);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        const isManualEvent = manualFlushPendingRef.current;
        if (isManualEvent) manualFlushPendingRef.current = false;

        const waiter = flushWaiterRef.current;

        if (!event.data || event.data.size === 0) {
          if (waiter && isManualEvent) {
            flushWaiterRef.current = null;
            waiter.resolve(true);
          }
          return;
        }

        const audioFile = new File([event.data], 'chunk.webm', {
          type: mimeType,
        });

        try {
          await onChunkReady(audioFile);
        } finally {
          if (waiter && isManualEvent) {
            flushWaiterRef.current = null;
            waiter.resolve(true);
          }
        }
      };

      mediaRecorder.start(30000);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start microphone:', error);
      alert('Please allow microphone permissions to use the copilot.');
    }
  }, [onChunkReady]);

  const flushChunk = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const token = {};
      flushWaiterRef.current = { resolve, token };
      manualFlushPendingRef.current = true;
      mr.requestData();

      setTimeout(() => {
        if (flushWaiterRef.current?.token === token) {
          flushWaiterRef.current = null;
          manualFlushPendingRef.current = false;
          resolve(false);
        }
      }, 12000);
    });
  }, []);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try {
        mr.requestData();
      } catch {
        /* ignore */
      }
      mr.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    setIsRecording(false);
    mediaRecorderRef.current = null;
    streamRef.current = null;
    manualFlushPendingRef.current = false;
    if (flushWaiterRef.current) {
      flushWaiterRef.current.resolve(false);
      flushWaiterRef.current = null;
    }
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    flushChunk,
  };
}
