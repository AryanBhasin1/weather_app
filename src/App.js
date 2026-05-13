import React, { useState, useEffect } from 'react';
import './App.css';

const WEATHER_API_KEY = "97009c1fd1db7b9652102f0d0444a025";
const FORECAST_API_KEY = "c6fa03b387a9a0615b52862a7470c33b";
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

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

function toF(c) {
  return (c * 9) / 5 + 32;
}
function displayTemp(celsius, unit) {
  return unit === 'C' ? Math.round(celsius) : Math.round(toF(celsius));
}

export default function App() {
  const [zip, setZip] = useState('');
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [unit, setUnit] = useState('F');
  const [isDark, setIsDark] = useState(false);
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('zipHistory')) || [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.setItem('zipHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const last = localStorage.getItem('lastZip');
    if (last) {
      setZip(last);
      fetchWeather(last);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchWeather(zipCode) {
    const trimmed = (zipCode || zip).trim();

    if (!/^\d{5}$/.test(trimmed)) {
      setError('Please enter a valid 5-digit US zip code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Step 1: Use Geocoding API to convert zip → accurate lat/lon + city name
      // (the direct /weather?zip= endpoint has a buggy geocoding database)
      const geoRes = await fetch(
        `https://api.openweathermap.org/geo/1.0/zip?zip=${trimmed},US&appid=${WEATHER_API_KEY}`
      );
      if (!geoRes.ok) throw new Error('Zip code not found. Please check and try again.');
      const { lat, lon, name: cityName } = await geoRes.json();

      // Step 2: Fetch weather + forecast by coordinates — accurate every time
      const [wRes, fRes] = await Promise.all([
        fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`),
        fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${FORECAST_API_KEY}&units=metric`),
      ]);

      if (!wRes.ok) {
        const err = await wRes.json();
        throw new Error(err.message || 'Failed to fetch weather.');
      }

      const wData = await wRes.json();
      const fData = await fRes.json();

      // Override the city name with the geocoded one — it's more reliable
      wData.name = cityName;

      setWeather(wData);
      setForecast(groupForecastByDay(fData.list));

      setHistory((prev) => {
        const entry = { zip: trimmed, city: cityName };
        const filtered = prev.filter((h) => h.zip !== trimmed);
        return [entry, ...filtered].slice(0, 6);
      });

      localStorage.setItem('lastZip', trimmed);
    } catch (err) {
      setError(err.message || 'Failed to fetch weather. Please try again.');
      setWeather(null);
      setForecast([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    fetchWeather(zip);
  }

  function handleHistoryClick(entry) {
    setZip(entry.zip);
    fetchWeather(entry.zip);
  }

  return (
    <div className={`app ${isDark ? 'dark' : 'light'}`}>
      <h1>Weather App</h1>

      {/* Search */}
      <div className="search">
        <form onSubmit={handleSubmit} style={{ display: 'inline' }}>
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Enter zip code (e.g. 75001)"
            maxLength={5}
            inputMode="numeric"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : 'Search'}
          </button>
        </form>

        <button onClick={() => setUnit(unit === 'F' ? 'C' : 'F')}>
          Switch to °{unit === 'F' ? 'C' : 'F'}
        </button>

        <button onClick={() => setIsDark(!isDark)}>
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>

      {/* Error */}
      {error && <p className="error">{error}</p>}

      {/* Current Weather */}
      {weather && !loading && (
        <div className="weather-info">
          <h2>{weather.name} ({localStorage.getItem('lastZip')})</h2>
          <img
            src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
            alt={weather.weather[0].description}
          />
          <p>
            <strong>{displayTemp(weather.main.temp, unit)}°{unit}</strong> —{' '}
            {weather.weather[0].description}
          </p>
          <p>Feels like: {displayTemp(weather.main.feels_like, unit)}°{unit}</p>
          <p>
            High: {displayTemp(weather.main.temp_max, unit)}°{unit} &nbsp;|&nbsp;
            Low: {displayTemp(weather.main.temp_min, unit)}°{unit}
          </p>
          <p>Humidity: {weather.main.humidity}%</p>
          <p>Wind: {Math.round(weather.wind.speed * 3.6)} km/h</p>
        </div>
      )}

      {/* 5-Day Forecast */}
      {forecast.length > 0 && !loading && (
        <div className="forecast">
          <h3>5-Day Forecast</h3>
          <div className="forecast-grid">
            {forecast.map((day) => (
              <div key={day.label} className="forecast-day">
                <p><strong>{day.label}</strong></p>
                <img
                  src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`}
                  alt={day.description}
                  width={48}
                />
                <p>{day.description}</p>
                <p>H: {displayTemp(day.high, unit)}°{unit}</p>
                <p>L: {displayTemp(day.low, unit)}°{unit}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search History */}
      {history.length > 0 && (
        <div className="history">
          <h3>Recent Searches</h3>
          <ul>
            {history.map((h) => (
              <li key={h.zip} onClick={() => handleHistoryClick(h)}>
                {h.zip} — {h.city}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
