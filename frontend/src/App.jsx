import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000/sensor-data/latest";

function App() {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activePage, setActivePage] = useState("Dashboard");

  const fetchSensorData = async () => {
    try {
      const response = await fetch(`${API_URL}?t=${Date.now()}`, {
        cache: "no-store",
      });

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
    let stopped = false;
    let timer;

    const poll = async () => {
      if (stopped) return;

      await fetchSensorData();

      if (!stopped) {
        timer = setTimeout(poll, 100);
      }
    };

    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const value = (number, decimals = 1) => {
    if (number === null || number === undefined) {
      return "--";
    }

    const numericValue = Number(number);

    if (Number.isNaN(numericValue)) {
      return "--";
    }

    return numericValue.toFixed(decimals);
  };

  const fingerDetected = data?.finger_detected === true;

  const heartRate = data?.heart_rate;
  const spo2 = data?.spo2;
  const temperature = data?.temperature;

  /*
   * Simple patient-facing interpretations.
   * These are not medical diagnoses.
   */

  const getHeartStatus = () => {
    if (
      !fingerDetected ||
      heartRate === null ||
      heartRate === undefined
    ) {
      return "Waiting for reading";
    }

    const hr = Number(heartRate);

    if (hr < 50 || hr > 120) {
      return "Outside usual range";
    }

    return "Within usual range";
  };

  const getSpo2Status = () => {
    if (
      !fingerDetected ||
      spo2 === null ||
      spo2 === undefined
    ) {
      return "Waiting for reading";
    }

    const oxygen = Number(spo2);

    if (oxygen < 94) {
      return "Needs attention";
    }

    return "Normal";
  };

  const getTemperatureStatus = () => {
    if (
      temperature === null ||
      temperature === undefined
    ) {
      return "Waiting for reading";
    }

    const temp = Number(temperature);

    if (temp < 35 || temp > 38) {
      return "Outside usual range";
    }

    return "Normal";
  };

  const overallStatus = connected
    ? "Monitoring is active"
    : "Connection needs attention";

  const overallDescription = connected
    ? "Your health data is being monitored continuously."
    : "We are waiting to reconnect to the monitoring device.";

  const navigationItems = [
    {
      name: "Dashboard",
      icon: "⌂",
    },
    {
      name: "My Health",
      icon: "▣",
    },
    {
      name: "Risk & Alerts",
      icon: "✦",
    },
    {
      name: "History",
      icon: "◷",
    },
    {
      name: "Reports",
      icon: "▤",
    },
    {
      name: "Profile",
      icon: "●",
    },
    {
      name: "Settings",
      icon: "⚙",
    },
  ];

  return (
    <div className="app">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="sidebar">

        <div className="sidebar-top">

          <div className="sidebar-brand">

            <div className="sidebar-brand-mark">
              ♥
            </div>

            <div>
              <div className="sidebar-brand-name">
                VitalCare
              </div>

              <div className="sidebar-brand-subtitle">
                Smart Health Monitoring
              </div>
            </div>

          </div>


          <nav className="sidebar-nav">

            <p className="nav-heading">
              MAIN MENU
            </p>

            {navigationItems.slice(0, 5).map((item) => (

              <button
                key={item.name}
                className={`nav-item ${
                  activePage === item.name
                    ? "nav-item-active"
                    : ""
                }`}
                onClick={() => setActivePage(item.name)}
              >

                <span className="nav-icon">
                  {item.icon}
                </span>

                <span>
                  {item.name}
                </span>

              </button>

            ))}


            <p className="nav-heading nav-heading-secondary">
              ACCOUNT
            </p>

            {navigationItems.slice(5).map((item) => (

              <button
                key={item.name}
                className={`nav-item ${
                  activePage === item.name
                    ? "nav-item-active"
                    : ""
                }`}
                onClick={() => setActivePage(item.name)}
              >

                <span className="nav-icon">
                  {item.icon}
                </span>

                <span>
                  {item.name}
                </span>

              </button>

            ))}

          </nav>

        </div>


        {/* DEVICE STATUS */}

        <div className="sidebar-device">

          <div className="sidebar-device-title">
            MONITORING DEVICE
          </div>

          <div className="sidebar-device-row">

            <span
              className={`sidebar-device-dot ${
                connected
                  ? "sidebar-device-online"
                  : "sidebar-device-offline"
              }`}
            ></span>

            <div>

              <strong>
                {connected
                  ? "Device connected"
                  : "Device disconnected"}
              </strong>

              <small>
                {connected
                  ? "Receiving live data"
                  : "Waiting for connection"}
              </small>

            </div>

          </div>

        </div>

      </aside>


      {/* =====================================================
          MAIN APPLICATION AREA
      ===================================================== */}

      <div className="main-area">

        {/* ===================================================
            TOP HEADER
        =================================================== */}

        <header className="topbar">

          <div className="mobile-brand">

            <div className="brand-mark">
              ♥
            </div>

            <div>
              <div className="brand-name">
                VitalCare
              </div>

              <div className="brand-subtitle">
                Smart Health Monitoring
              </div>
            </div>

          </div>


          <div className="header-actions">

            <button
              className="icon-button"
              aria-label="Notifications"
            >
              <span>🔔</span>
            </button>


            <button className="profile-button">

              <span className="profile-avatar">
                G
              </span>

              <span className="profile-name">
                Gokul
              </span>

              <span className="chevron">
                ˅
              </span>

            </button>

          </div>

        </header>


        {/* ===================================================
            PAGE CONTENT
        =================================================== */}

        <main>

          {activePage === "Dashboard" ? (

            <>
              {/* =================================================
                  WELCOME
              ================================================= */}

              <section className="welcome-section">

                <div>

                  <p className="page-label">
                    PATIENT DASHBOARD
                  </p>

                  <h1>
                    Good afternoon, Gokul <span>👋</span>
                  </h1>

                  <p className="welcome-text">
                    Here is your current health overview.
                  </p>

                </div>


                <div
                  className={`device-status ${
                    connected
                      ? "device-online"
                      : "device-offline"
                  }`}
                >

                  <span className="device-dot"></span>

                  <div>

                    <strong>
                      {connected
                        ? "Monitoring active"
                        : "Device disconnected"}
                    </strong>

                    <small>
                      {connected
                        ? "ESP32 connected"
                        : "Check your monitoring device"}
                    </small>

                  </div>

                </div>

              </section>


              {/* =================================================
                  OVERALL HEALTH STATUS
              ================================================= */}

              <section
                className={`health-banner ${
                  connected
                    ? "health-normal"
                    : "health-warning"
                }`}
              >

                <div className="health-status-icon">
                  {connected ? "✓" : "!"}
                </div>

                <div className="health-banner-content">

                  <p>
                    CURRENT STATUS
                  </p>

                  <h2>
                    {overallStatus}
                  </h2>

                  <span>
                    {overallDescription}
                  </span>

                </div>


                <div className="last-checked">

                  <span>
                    LAST UPDATED
                  </span>

                  <strong>
                    {lastUpdated
                      ? lastUpdated.toLocaleTimeString()
                      : "Waiting..."}
                  </strong>

                </div>

              </section>


              {/* =================================================
                  VITALS
              ================================================= */}

              <section className="section">

                <div className="section-title-row">

                  <div>

                    <p className="section-label">
                      YOUR VITALS
                    </p>

                    <h2>
                      Current health readings
                    </h2>

                  </div>

                  <div className="live-indicator">

                    <span></span>

                    LIVE

                  </div>

                </div>


                <div className="vitals-grid">

                  {/* HEART RATE */}

                  <article className="vital-card">

                    <div className="vital-icon heart">
                      ♥
                    </div>

                    <div className="vital-heading">

                      <span>
                        Heart Rate
                      </span>

                      <small>
                        ❤️
                      </small>

                    </div>

                    <div className="vital-value">

                      {value(heartRate, 0)}

                      <span>
                        BPM
                      </span>

                    </div>

                    <div
                      className={`vital-status ${
                        getHeartStatus().includes("Outside")
                          ? "status-warning"
                          : "status-normal"
                      }`}
                    >

                      <span></span>

                      {getHeartStatus()}

                    </div>

                  </article>


                  {/* SPO2 */}

                  <article className="vital-card">

                    <div className="vital-icon oxygen">
                      O₂
                    </div>

                    <div className="vital-heading">

                      <span>
                        Oxygen Level
                      </span>

                      <small>
                        🫁
                      </small>

                    </div>

                    <div className="vital-value">

                      {value(spo2, 0)}

                      <span>
                        %
                      </span>

                    </div>

                    <div
                      className={`vital-status ${
                        getSpo2Status().includes("attention")
                          ? "status-warning"
                          : "status-normal"
                      }`}
                    >

                      <span></span>

                      {getSpo2Status()}

                    </div>

                  </article>


                  {/* TEMPERATURE */}

                  <article className="vital-card">

                    <div className="vital-icon temperature">
                      °
                    </div>

                    <div className="vital-heading">

                      <span>
                        Temperature
                      </span>

                      <small>
                        🌡️
                      </small>

                    </div>

                    <div className="vital-value">

                      {value(temperature, 1)}

                      <span>
                        °C
                      </span>

                    </div>

                    <div className="vital-status status-normal">

                      <span></span>

                      {getTemperatureStatus()}

                    </div>

                  </article>


                  {/* SEIZURE RISK */}

                  <article className="vital-card risk-card">

                    <div className="vital-icon risk">
                      ✦
                    </div>

                    <div className="vital-heading">

                      <span>
                        Seizure Risk
                      </span>

                      <small>
                        🧠
                      </small>

                    </div>

                    <div className="risk-value">
                      LOW
                    </div>

                    <div className="vital-status status-normal">

                      <span></span>

                      No current concern

                    </div>

                  </article>

                </div>

              </section>


              {/* =================================================
                  LOWER DASHBOARD
              ================================================= */}

              <section className="dashboard-grid">

                {/* HEART RATE TREND */}

                <article className="panel trend-panel">

                  <div className="panel-header">

                    <div>

                      <p className="section-label">
                        HEART RATE
                      </p>

                      <h2>
                        Live trend
                      </h2>

                    </div>

                    <div className="trend-current">

                      <strong>
                        {value(heartRate, 0)}
                      </strong>

                      <span>
                        BPM
                      </span>

                    </div>

                  </div>


                  <div className="chart-placeholder">

                    <div className="chart-grid-lines">

                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>

                    </div>


                    <svg
                      className="trend-svg"
                      viewBox="0 0 600 170"
                      preserveAspectRatio="none"
                    >

                      <path
                        d="
                          M0 115
                          C35 110, 45 90, 75 101
                          S125 125, 155 98
                          S205 80, 235 100
                          S285 128, 315 92
                          S365 82, 395 102
                          S445 116, 475 88
                          S530 72, 555 92
                          S585 102, 600 78
                        "
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />

                    </svg>


                    <div className="chart-labels">

                      <span>
                        Now
                      </span>

                      <span>
                        Recent
                      </span>

                      <span>
                        Live
                      </span>

                    </div>

                  </div>

                </article>


                {/* SEIZURE RISK */}

                <article className="panel risk-panel">

                  <div className="panel-header">

                    <div>

                      <p className="section-label">
                        SAFETY MONITOR
                      </p>

                      <h2>
                        Seizure risk
                      </h2>

                    </div>

                    <span className="normal-pill">
                      LOW RISK
                    </span>

                  </div>


                  <div className="risk-content">

                    <div className="risk-circle">

                      <div>

                        <strong>
                          LOW
                        </strong>

                        <span>
                          Current risk
                        </span>

                      </div>

                    </div>


                    <div className="risk-message">

                      <h3>
                        No concerning pattern detected
                      </h3>

                      <p>
                        The monitoring system is continuously
                        analysing your sensor data.
                      </p>

                      <button className="text-button">
                        View risk details
                        <span>→</span>
                      </button>

                    </div>

                  </div>

                </article>

              </section>


              {/* =================================================
                  RECENT ACTIVITY
              ================================================= */}

              <section className="section recent-section">

                <div className="section-title-row">

                  <div>

                    <p className="section-label">
                      TODAY
                    </p>

                    <h2>
                      Recent activity
                    </h2>

                  </div>

                </div>


                <div className="activity-card">

                  <div className="activity-icon">
                    ✓
                  </div>

                  <div className="activity-content">

                    <strong>
                      Monitoring is running normally
                    </strong>

                    <p>
                      No concerning health events have been
                      detected in the current monitoring session.
                    </p>

                  </div>

                  <span className="activity-time">
                    Just now
                  </span>

                </div>

              </section>


              {/* =================================================
                  MONITORING STRIP
              ================================================= */}

              <section className="monitoring-strip">

                <div className="monitoring-item">

                  <span className="monitoring-icon">
                    ●
                  </span>

                  <div>

                    <strong>
                      Device
                    </strong>

                    <small>
                      {connected
                        ? "Connected"
                        : "Disconnected"}
                    </small>

                  </div>

                </div>


                <div className="monitoring-divider"></div>


                <div className="monitoring-item">

                  <span className="monitoring-icon">
                    ↗
                  </span>

                  <div>

                    <strong>
                      Data streaming
                    </strong>

                    <small>
                      {connected
                        ? "Receiving live data"
                        : "Waiting for data"}
                    </small>

                  </div>

                </div>


                <div className="monitoring-divider"></div>


                <div className="monitoring-item">

                  <span className="monitoring-icon">
                    ◷
                  </span>

                  <div>

                    <strong>
                      Last reading
                    </strong>

                    <small>
                      {lastUpdated
                        ? lastUpdated.toLocaleTimeString()
                        : "--"}
                    </small>

                  </div>

                </div>

              </section>

            </>

          ) : (

            /* ===================================================
               TEMPORARY PAGE PLACEHOLDER
            =================================================== */

            <section className="placeholder-page">

              <div className="placeholder-icon">
                {navigationItems.find(
                  (item) => item.name === activePage
                )?.icon}
              </div>

              <p className="page-label">
                PATIENT PORTAL
              </p>

              <h1>
                {activePage}
              </h1>

              <p>
                This section will have its own dedicated
                page and features.
              </p>

              <button
                className="back-dashboard-button"
                onClick={() => setActivePage("Dashboard")}
              >
                ← Back to Dashboard
              </button>

            </section>

          )}

        </main>


        {/* ===================================================
            FOOTER
        =================================================== */}

        <footer>

          <span>
            VitalCare Smart Health Monitoring System
          </span>

          <span>
            For personal monitoring purposes
          </span>

        </footer>

      </div>

    </div>
  );
}

export default App;