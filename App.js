import React, { useEffect, useState } from "react";

const WEATHER_API_KEY = "97009c1fd1db7b9652102f0d0444a025";
const FORECAST_API_KEY = "c6fa03b387a9a0615b52862a7470c33b";

function App() {
  const [city, setCity] = useState(localStorage.getItem("lastCity") || "");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [unit, setUnit] = useState("metric"); // 'metric' for Celsius, 'imperial' for Fahrenheit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(
    JSON.parse(localStorage.getItem("history")) || []
  );

  const handleSearch = async () => {
    if (!city) return;
    setLoading(true);
    setError("");
    try {
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=${unit}`
      );
      if (!weatherRes.ok) throw new Error("City not found");
      const weatherData = await weatherRes.json();
      setWeather(weatherData);

      const forecastRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${FORECAST_API_KEY}&units=${unit}`
      );
      const forecastData = await forecastRes.json();
      const daily = forecastData.list.filter((_, index) => index % 8 === 0);
      setForecast(daily);

      localStorage.setItem("lastCity", city);
      const updatedHistory = [city, ...history.filter((c) => c !== city)].slice(
        0,
        5
      );
      setHistory(updatedHistory);
      localStorage.setItem("history", JSON.stringify(updatedHistory));
    } catch (err) {
      setError(err.message);
      setWeather(null);
      setForecast([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleUnit = () => {
    setUnit((prev) => (prev === "metric" ? "imperial" : "metric"));
  };

  useEffect(() => {
    if (city) handleSearch();
    // eslint-disable-next-line
  }, [unit]);

  return (
    <div className={`app ${unit === "metric" ? "light" : "dark"}`}>
      <h1>Weather Dashboard</h1>
      <div className="search">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Enter city"
        />
        <button onClick={handleSearch}>Search</button>
        <button onClick={toggleUnit}>°C / °F</button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {weather && (
        <div className="weather-info">
          <h2>{weather.name}</h2>
          <p>
            Temperature: {weather.main.temp}° {unit === "metric" ? "C" : "F"}
          </p>
          <p>Humidity: {weather.main.humidity}%</p>
          <p>
            Wind: {weather.wind.speed} {unit === "metric" ? "m/s" : "mph"}
          </p>
          <p>Description: {weather.weather[0].description}</p>
          <img
            alt="icon"
            src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
          />
        </div>
      )}

      {forecast.length > 0 && (
        <div className="forecast">
          <h3>5-Day Forecast</h3>
          <div className="forecast-grid">
            {forecast.map((day, index) => (
              <div key={index} className="forecast-day">
                <p>{new Date(day.dt_txt).toLocaleDateString()}</p>
                <p>Temp: {day.main.temp}°</p>
                <p>{day.weather[0].main}</p>
                <img
                  alt="icon"
                  src={`https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="history">
          <h4>Search History</h4>
          <ul>
            {history.map((item, idx) => (
              <li key={idx} onClick={() => setCity(item)}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
