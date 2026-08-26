import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000/sensor-data/latest";

function App() {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchSensorData = async () => {
    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const result = await response.json();

      if (result.data) {
        setData(result.data);
        setConnected(true);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Sensor API error:", error);
      setConnected(false);
    }
  };

  useEffect(() => {
    fetchSensorData();

    const interval = setInterval(fetchSensorData, 1000);

    return () => clearInterval(interval);
  }, []);

  const value = (number, decimals = 1) => {
    if (number === null || number === undefined) {
      return "--";
    }

    return Number(number).toFixed(decimals);
  };

  const heartRate = data?.heart_rate ?? 0;
  const spo2 = data?.spo2;
  const temperature = data?.temperature;
  const humidity = data?.humidity;

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="eyebrow">SMART HEALTH</div>
          <h1>Health Monitoring System</h1>
          <p>Real-time sensor monitoring</p>
        </div>

        <div className={`connection ${connected ? "online" : "offline"}`}>
          <span className="status-dot"></span>
          {connected ? "ESP32 Connected" : "Disconnected"}
        </div>
      </header>

      <main>
        <section className="vitals-grid">
          <div className="card heart-card">
            <div className="card-top">
              <span className="icon">♥</span>
              <span className="label">HEART RATE</span>
            </div>

            <div className="main-value">
              {value(heartRate)}
              <span>BPM</span>
            </div>

            <p className="description">
              {heartRate > 0 ? "Heart rate detected" : "Place finger on MAX30102"}
            </p>
          </div>

          <div className="card">
            <div className="card-top">
              <span className="icon">◉</span>
              <span className="label">SpO₂</span>
            </div>

            <div className="main-value">
              {spo2 === null || spo2 === undefined ? "--" : value(spo2)}
              <span>%</span>
            </div>

            <p className="description">
              Blood oxygen level
            </p>
          </div>

          <div className="card">
            <div className="card-top">
              <span className="icon">♨</span>
              <span className="label">TEMPERATURE</span>
            </div>

            <div className="main-value">
              {value(temperature)}
              <span>°C</span>
            </div>

            <p className="description">
              Body/environment temperature
            </p>
          </div>

          <div className="card">
            <div className="card-top">
              <span className="icon">💧</span>
              <span className="label">HUMIDITY</span>
            </div>

            <div className="main-value">
              {value(humidity)}
              <span>%</span>
            </div>

            <p className="description">
              Current humidity
            </p>
          </div>
        </section>

        <section className="sensor-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">MOTION SENSORS</div>
              <h2>Movement & Orientation</h2>
            </div>

            <div className="live-badge">
              <span></span>
              LIVE
            </div>
          </div>

          <div className="motion-grid">
            <div className="sensor-card">
              <h3>Accelerometer</h3>
              <p className="sensor-description">
                Linear acceleration
              </p>

              <div className="axis-grid">
                <div>
                  <span>X</span>
                  <strong>{value(data?.accel_x, 3)}</strong>
                  <small>g</small>
                </div>

                <div>
                  <span>Y</span>
                  <strong>{value(data?.accel_y, 3)}</strong>
                  <small>g</small>
                </div>

                <div>
                  <span>Z</span>
                  <strong>{value(data?.accel_z, 3)}</strong>
                  <small>g</small>
                </div>
              </div>
            </div>

            <div className="sensor-card">
              <h3>Gyroscope</h3>
              <p className="sensor-description">
                Rotational movement
              </p>

              <div className="axis-grid">
                <div>
                  <span>X</span>
                  <strong>{value(data?.gyro_x, 3)}</strong>
                  <small>rad/s</small>
                </div>

                <div>
                  <span>Y</span>
                  <strong>{value(data?.gyro_y, 3)}</strong>
                  <small>rad/s</small>
                </div>

                <div>
                  <span>Z</span>
                  <strong>{value(data?.gyro_z, 3)}</strong>
                  <small>rad/s</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="raw-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">MAX30102</div>
              <h2>Pulse Sensor Data</h2>
            </div>
          </div>

          <div className="raw-grid">
            <div className="raw-card">
              <span>IR VALUE</span>
              <strong>{data?.ir_value ?? "--"}</strong>
            </div>

            <div className="raw-card">
              <span>RED VALUE</span>
              <strong>{data?.red_value ?? "--"}</strong>
            </div>

            <div className="raw-card">
              <span>FINGER</span>
              <strong>
                {data?.finger_detected ? "DETECTED" : "NOT DETECTED"}
              </strong>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <span>Smart Health Monitoring System</span>

        <span>
          {lastUpdated
            ? `Last updated ${lastUpdated.toLocaleTimeString()}`
            : "Waiting for sensor data..."}
        </span>
      </footer>
    </div>
  );
}

export default App;