"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedItem, Alert, WidgetMetrics } from "@/lib/types";

export interface EventStreamHandlers {
  onFeedItem?: (item: FeedItem) => void;
  onAlert?: (alert: Alert) => void;
  onWidgetUpdate?: (update: WidgetMetrics) => void;
}

/**
 * Opens a persistent SSE connection to /api/events.
 * Handlers are kept current via a ref so callers never need to worry about
 * stale closures — safe to pass inline arrow functions.
 */
export function useEventStream(handlers: EventStreamHandlers): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  // Keep handlers fresh without restarting the connection
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    // EventSource is browser-only
    if (typeof EventSource === "undefined") return;

    const es = new EventSource("/api/events");

    const onOpen = () => setConnected(true);
    const onError = () => setConnected(false); // EventSource auto-reconnects

    const onFeedItem = (e: Event) => {
      const msg = e as MessageEvent;
      try {
        handlersRef.current.onFeedItem?.(JSON.parse(msg.data) as FeedItem);
      } catch {
        // Malformed payload — ignore
      }
    };

    const onAlert = (e: Event) => {
      const msg = e as MessageEvent;
      try {
        handlersRef.current.onAlert?.(JSON.parse(msg.data) as Alert);
      } catch {
        // Malformed payload — ignore
      }
    };

    const onWidgetUpdate = (e: Event) => {
      const msg = e as MessageEvent;
      try {
        handlersRef.current.onWidgetUpdate?.(JSON.parse(msg.data) as WidgetMetrics);
      } catch {
        // Malformed payload — ignore
      }
    };

    es.addEventListener("open", onOpen);
    es.addEventListener("error", onError);
    es.addEventListener("feed_item", onFeedItem);
    es.addEventListener("alert", onAlert);
    es.addEventListener("widget_update", onWidgetUpdate);

    return () => {
      es.removeEventListener("open", onOpen);
      es.removeEventListener("error", onError);
      es.removeEventListener("feed_item", onFeedItem);
      es.removeEventListener("alert", onAlert);
      es.removeEventListener("widget_update", onWidgetUpdate);
      es.close();
      setConnected(false);
    };
  }, []); // Single connection for the lifetime of the component

  return { connected };
}
