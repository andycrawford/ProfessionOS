"use client";

import { useState, useEffect, useCallback } from "react";
import { CloudSun, Thermometer, Droplets, Wind } from "lucide-react";
import styles from "./WeatherWidget.module.css";

interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

interface WeatherWidgetProps {
  config?: Record<string, unknown>;
}

export default function WeatherWidget({ config }: WeatherWidgetProps) {
  const city = (config?.city as string) ?? "";
  const state = (config?.state as string) ?? "";
  const country = (config?.country as string) ?? "US";

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const locationLabel = [city, state, country].filter(Boolean).join(", ");

  const fetchWeather = useCallback(async () => {
    if (!city) {
      setError("Set a city in Dashboard settings.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/weather?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=${encodeURIComponent(country)}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load weather.");
        return;
      }
      const data: WeatherData = await res.json();
      setWeather(data);
    } catch {
      setError("Weather unavailable.");
    } finally {
      setLoading(false);
    }
  }, [city, state, country]);

  useEffect(() => {
    fetchWeather();
    // Refresh every 10 minutes
    const id = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchWeather]);

  if (!city) {
    return (
      <div className={styles.weather}>
        <CloudSun size={28} className={styles.iconMuted} />
        <span className={styles.hint}>
          Configure a location in
          <br />
          Dashboard settings.
        </span>
      </div>
    );
  }

  if (loading && !weather) {
    return (
      <div className={styles.weather}>
        <span className={styles.hint}>Loading…</span>
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className={styles.weather}>
        <CloudSun size={28} className={styles.iconMuted} />
        <span className={styles.error}>{error}</span>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className={styles.weather}>
      <div className={styles.location}>{locationLabel}</div>
      <div className={styles.condition}>{weather.condition}</div>
      <div className={styles.tempRow}>
        <Thermometer size={16} />
        <span className={styles.temp}>{weather.temp}°F</span>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detail}>
          <Droplets size={12} /> {weather.humidity}%
        </span>
        <span className={styles.detail}>
          <Wind size={12} /> {weather.windSpeed} mph
        </span>
      </div>
    </div>
  );
}
