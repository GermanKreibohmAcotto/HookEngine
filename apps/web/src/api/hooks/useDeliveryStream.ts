import { useEffect, useState } from 'react';

import { useRequiredApiKey } from '../../auth/ApiKeyContext';
import { sseUrl } from '../client';
import type { DeliveryStreamEvent } from '../types';

const MAX_EVENTS = 50;

export interface DeliveryStreamState {
  events: DeliveryStreamEvent[];
  connected: boolean;
}

/** Live feed of delivery outcomes over SSE. The browser reconnects automatically on drop. */
export function useDeliveryStream(): DeliveryStreamState {
  const apiKey = useRequiredApiKey();
  const [events, setEvents] = useState<DeliveryStreamEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(sseUrl(apiKey, '/api/v1/stream/deliveries'));

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(message.data) as DeliveryStreamEvent;
        setEvents((previous) => [parsed, ...previous].slice(0, MAX_EVENTS));
      } catch {
        // Malformed frame — drop it, the stream keeps going.
      }
    };

    return () => {
      source.close();
    };
  }, [apiKey]);

  return { events, connected };
}
