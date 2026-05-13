import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const WEATHER_API_KEY = "97009c1fd1db7b9652102f0d0444a025";
const FORECAST_API_KEY = "c6fa03b387a9a0615b52862a7470c33b";
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// ─── Helper: group forecast list into daily buckets ───────────────────────────
function groupForecastByDay(list) {
  const days = {};
  list.forEach((item) => {
    const date = new Date(item.dt * 1000);
    const key = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!days[key]) {
      days[key] = { temps: [], icons: [], descriptions: [] };
    }
    days[key].temps.push(item.main.temp);
    days[key].icons.push(item.weather[0].icon);
    days[key].descriptions.push(item.weather[0].description);
  });

  return Object.entries(days)
    .slice(0, 5)
    .map(([label, data]) => ({
      label,
      high: Math.max(...data.temps),
      low: Math.min(...data.temps),
      icon: data.icons[Math.floor(data.icons.length / 2)],
      description: data.descriptions[Math.floor(data.descriptions.length / 2)],
    }));
}

// ─── Helper: convert temperature ──────────────────────────────────────────────
function toF(c) {
  return (c * 9) / 5 + 32;
}
function displayTemp(celsius, unit) {
  return unit === 'C' ? Math.round(celsius) : Math.round(toF(celsius));
}

// ─── WeatherIcon ──────────────────────────────────────────────────────────────
function WeatherIcon({ icon, alt, size = 64 }) {
  return (
    <img
      src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
      alt={alt}
      width={size}
      height={size}
      className="weather-icon"
    />
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [zip, setZip] = useState('');
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [unit, setUnit] = useState('F');
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('zipHistory')) || [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('cool');

  // Persist history
  useEffect(() => {
    localStorage.setItem('zipHistory', JSON.stringify(history));
  }, [history]);

  // Set theme based on temperature
  useEffect(() => {
    if (!weather) return;
    const tempC = weather.main.temp;
    if (tempC >= 30) setTheme('hot');
    else if (tempC >= 15) setTheme('warm');
    else setTheme('cool');
  }, [weather]);

  // Restore last search on mount
  useEffect(() => {
    const last = localStorage.getItem('lastZip');
    if (last) fetchWeather(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWeather = useCallback(async (zipCode) => {
    const trimmed = (zipCode || zip).trim();

    if (!/^\d{5}$/.test(trimmed)) {
      setError('Please enter a valid 5-digit US zip code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [wRes, fRes] = await Promise.all([
        fetch(`${BASE_URL}/weather?zip=${trimmed},us&appid=${WEATHER_API_KEY}&units=metric`),
        fetch(`${BASE_URL}/forecast?zip=${trimmed},us&appid=${FORECAST_API_KEY}&units=metric`),
      ]);

      if (!wRes.ok) {
        const err = await wRes.json();
        throw new Error(err.message || 'City not found for that zip code.');
      }

      const wData = await wRes.json();
      const fData = await fRes.json();

      setWeather(wData);
      setForecast(groupForecastByDay(fData.list));

      // Update history (deduplicated, max 6)
      setHistory((prev) => {
        const entry = { zip: trimmed, city: wData.name };
        const filtered = prev.filter((h) => h.zip !== trimmed);
        return [entry, ...filtered].slice(0, 6);
      });

      localStorage.setItem('lastZip', trimmed);
    } catch (err) {
      setError(err.message || 'Failed to fetch weather. Check your zip code and try again.');
      setWeather(null);
      setForecast([]);
    } finally {
      setLoading(false);
    }
  }, [zip]);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchWeather(zip);
  };

  const handleHistoryClick = (entry) => {
    setZip(entry.zip);
    fetchWeather(entry.zip);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('zipHistory');
  };

  return (
    <div className={`app theme-${theme}`}>
      <div className="app-bg" />

      <header className="app-header">
        <h1 className="app-title">
          <span className="title-icon">☁</span> WeatherZip
        </h1>
        <p className="app-subtitle">Enter a US zip code to get current conditions</p>
      </header>

      {/* ── Search Form ── */}
      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-row">
          <input
            type="text"
            className="zip-input"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g. 75001"
            maxLength={5}
            inputMode="numeric"
            aria-label="Zip code"
          />
          <button type="submit" className="search-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Search'}
          </button>
        </div>

        {/* Unit Toggle */}
        <div className="unit-toggle">
          <button
            type="button"
            className={`unit-btn ${unit === 'F' ? 'active' : ''}`}
            onClick={() => setUnit('F')}
          >
            °F
          </button>
          <button
            type="button"
            className={`unit-btn ${unit === 'C' ? 'active' : ''}`}
            onClick={() => setUnit('C')}
          >
            °C
          </button>
        </div>
      </form>

      {/* ── Error ── */}
      {error && (
        <div className="error-banner" role="alert">
          ⚠ {error}
        </div>
      )}

      {/* ── Search History ── */}
      {history.length > 0 && (
        <div className="history-section">
          <div className="history-header">
            <span className="history-label">Recent</span>
            <button className="clear-btn" onClick={clearHistory} type="button">
              Clear
            </button>
          </div>
          <div className="history-chips">
            {history.map((h) => (
              <button
                key={h.zip}
                className="history-chip"
                onClick={() => handleHistoryClick(h)}
                type="button"
              >
                <span className="chip-zip">{h.zip}</span>
                <span className="chip-city">{h.city}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Current Weather Card ── */}
      {weather && !loading && (
        <div className="weather-card">
          <div className="card-location">
            <h2 className="city-name">{weather.name}</h2>
            <span className="zip-badge">ZIP {localStorage.getItem('lastZip')}</span>
          </div>

          <div className="card-main">
            <div className="temp-block">
              <span className="temp-value">
                {displayTemp(weather.main.temp, unit)}°{unit}
              </span>
              <span className="feels-like">
                Feels like {displayTemp(weather.main.feels_like, unit)}°{unit}
              </span>
            </div>
            <div className="icon-block">
              <WeatherIcon icon={weather.weather[0].icon} alt={weather.weather[0].description} size={96} />
              <span className="description">
                {weather.weather[0].description
                  .split(' ')
                  .map((w) => w[0].toUpperCase() + w.slice(1))
                  .join(' ')}
              </span>
            </div>
          </div>

          <div className="card-stats">
            <div className="stat">
              <span className="stat-label">High</span>
              <span className="stat-value">
                {displayTemp(weather.main.temp_max, unit)}°
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Low</span>
              <span className="stat-value">
                {displayTemp(weather.main.temp_min, unit)}°
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Humidity</span>
              <span className="stat-value">{weather.main.humidity}%</span>
            </div>
            <div className="stat">
              <span className="stat-label">Wind</span>
              <span className="stat-value">{Math.round(weather.wind.speed * 3.6)} km/h</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 5-Day Forecast ── */}
      {forecast.length > 0 && !loading && (
        <div className="forecast-section">
          <h3 className="forecast-title">5-Day Forecast</h3>
          <div className="forecast-grid">
            {forecast.map((day) => (
              <div key={day.label} className="forecast-card">
                <span className="forecast-day">{day.label}</span>
                <WeatherIcon icon={day.icon} alt={day.description} size={48} />
                <span className="forecast-desc">{day.description}</span>
                <div className="forecast-temps">
                  <span className="f-high">{displayTemp(day.high, unit)}°</span>
                  <span className="f-sep">/</span>
                  <span className="f-low">{displayTemp(day.low, unit)}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="app-footer">
        Powered by <a href="https://openweathermap.org" target="_blank" rel="noreferrer">OpenWeather</a>
      </footer>
    </div>
  );
}
