import { useEffect, useState } from "react";
import "./App.css";

import MyHealth from "./pages/MyHealth";
import RiskAlerts from "./pages/RiskAlerts";

const API_URL = "http://127.0.0.1:8000/sensor-data/latest";

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

function App() {
  const [activePage, setActivePage] = useState("Dashboard");

  const [data, setData] = useState(null);

  const [connected, setConnected] = useState(false);

  const [lastUpdated, setLastUpdated] = useState(null);


  // ============================================================
  // FETCH LIVE SENSOR DATA
  // ============================================================

  const fetchSensorData = async () => {
    try {
      const response = await fetch(
        `${API_URL}?t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

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


  // ============================================================
  // LIVE POLLING
  // ============================================================

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


  // ============================================================
  // FORMAT VALUES
  // ============================================================

  const value = (number, decimals = 1) => {
    if (
      number === null ||
      number === undefined
    ) {
      return "--";
    }

    const numericValue = Number(number);

    if (Number.isNaN(numericValue)) {
      return "--";
    }

    return numericValue.toFixed(decimals);
  };


  // ============================================================
  // CURRENT SENSOR VALUES
  // ============================================================

  const fingerDetected =
    data?.finger_detected === true;

  const heartRate =
    data?.heart_rate;

  const spo2 =
    data?.spo2;

  const temperature =
    data?.temperature;


  // ============================================================
  // HEART RATE STATUS
  // ============================================================

  const getHeartStatus = () => {
    if (
      !fingerDetected ||
      heartRate === null ||
      heartRate === undefined
    ) {
      return "Waiting for reading";
    }

    const hr = Number(heartRate);

    if (Number.isNaN(hr)) {
      return "Waiting for reading";
    }

    if (
      hr < 50 ||
      hr > 120
    ) {
      return "Outside usual range";
    }

    return "Within usual range";
  };


  // ============================================================
  // SPO2 STATUS
  // ============================================================

  const getSpo2Status = () => {
    if (
      !fingerDetected ||
      spo2 === null ||
      spo2 === undefined
    ) {
      return "Waiting for reading";
    }

    const oxygen =
      Number(spo2);

    if (Number.isNaN(oxygen)) {
      return "Waiting for reading";
    }

    if (oxygen < 94) {
      return "Needs attention";
    }

    return "Normal";
  };


  // ============================================================
  // ROOM TEMPERATURE STATUS
  //
  // IMPORTANT:
  // The current DHT11 sensor is being treated as an ambient /
  // room temperature sensor.
  //
  // We therefore DO NOT compare it against 35–38 °C.
  // ============================================================

  const getTemperatureStatus = () => {
    if (
      temperature === null ||
      temperature === undefined
    ) {
      return "Waiting for reading";
    }

    return "Room temperature";
  };


  // ============================================================
  // OVERALL STATUS
  // ============================================================

  const overallStatus =
    connected
      ? "Monitoring is active"
      : "Connection needs attention";


  const overallDescription =
    connected
      ? "Your health data is being monitored continuously."
      : "We are waiting to reconnect to the monitoring device.";


  // ============================================================
  // NAVIGATION
  // ============================================================

  const handleNavigation = (page) => {
    setActivePage(page);
  };


  // ============================================================
  // COMING SOON PAGE
  // ============================================================

  const ComingSoonPage = ({
    title,
    description,
    icon,
  }) => {
    return (
      <div className="page-container">

        <div className="page-header">

          <div>
            <p className="page-label">
              VITALCARE
            </p>

            <h1>
              {title}
            </h1>

            <p className="welcome-text">
              {description}
            </p>
          </div>

        </div>


        <div className="panel">

          <div
            style={{
              padding: "50px",
              textAlign: "center",
            }}
          >

            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 20px",
                borderRadius: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                background: "#eef4ff",
              }}
            >
              {icon}
            </div>

            <h2>
              {title}
            </h2>

            <p
              style={{
                maxWidth: "520px",
                margin: "12px auto 0",
                lineHeight: "1.7",
                color: "#718096",
              }}
            >
              This section is being prepared
              for the VitalCare monitoring system.
            </p>

          </div>

        </div>

      </div>
    );
  };


  // ============================================================
  // DASHBOARD
  // ============================================================

  const Dashboard = () => {
    return (
      <>

        {/* ======================================================
            WELCOME
        ====================================================== */}

        <section className="welcome-section">

          <div>

            <p className="page-label">
              PATIENT DASHBOARD
            </p>

            <h1>
              Good afternoon <span>👋</span>
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


        {/* ======================================================
            OVERALL HEALTH STATUS
        ====================================================== */}

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


        {/* ======================================================
            VITALS
        ====================================================== */}

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


            {/* ==================================================
                HEART RATE
            ================================================== */}

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

                {value(
                  heartRate,
                  0
                )}

                <span>
                  BPM
                </span>

              </div>


              <div
                className={`vital-status ${
                  getHeartStatus().includes(
                    "Outside"
                  )
                    ? "status-warning"
                    : "status-normal"
                }`}
              >

                <span></span>

                {getHeartStatus()}

              </div>

            </article>


            {/* ==================================================
                SPO2
            ================================================== */}

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

                {value(
                  spo2,
                  0
                )}

                <span>
                  %
                </span>

              </div>


              <div
                className={`vital-status ${
                  getSpo2Status().includes(
                    "attention"
                  )
                    ? "status-warning"
                    : "status-normal"
                }`}
              >

                <span></span>

                {getSpo2Status()}

              </div>

            </article>


            {/* ==================================================
                ROOM TEMPERATURE
            ================================================== */}

            <article className="vital-card">

              <div className="vital-icon temperature">
                °
              </div>


              <div className="vital-heading">

                <span>
                  Room Temperature
                </span>

                <small>
                  🌡️
                </small>

              </div>


              <div className="vital-value">

                {value(
                  temperature,
                  1
                )}

                <span>
                  °C
                </span>

              </div>


              <div className="vital-status status-normal">

                <span></span>

                {getTemperatureStatus()}

              </div>

            </article>


            {/* ==================================================
                SEIZURE RISK
            ================================================== */}

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


        {/* ======================================================
            LOWER DASHBOARD
        ====================================================== */}

        <section className="dashboard-grid">


          {/* ====================================================
              HEART RATE TREND
          ==================================================== */}

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
                  {value(
                    heartRate,
                    0
                  )}
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


          {/* ====================================================
              SEIZURE RISK
          ==================================================== */}

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
                  The monitoring system is
                  continuously analysing your
                  sensor data.
                </p>


                <button
                  className="text-button"
                  onClick={() =>
                    setActivePage(
                      "Risk & Alerts"
                    )
                  }
                >

                  View risk details

                  <span>
                    →
                  </span>

                </button>

              </div>

            </div>

          </article>

        </section>


        {/* ======================================================
            RECENT ACTIVITY
        ====================================================== */}

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
                No concerning health events have
                been detected in the current
                monitoring session.
              </p>

            </div>


            <span className="activity-time">
              Just now
            </span>

          </div>

        </section>


        {/* ======================================================
            MONITORING FOOTER STATUS
        ====================================================== */}

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
    );
  };


  // ============================================================
  // MAIN CONTENT
  // ============================================================

  const renderPage = () => {

    if (
      activePage === "Dashboard"
    ) {

      return (
        <Dashboard />
      );
    }


    if (
      activePage === "My Health"
    ) {

      return (
        <MyHealth />
      );
    }


    if (
      activePage === "Risk & Alerts"
    ) {

      return (
        <RiskAlerts />
      );
    }


    if (
      activePage === "History"
    ) {

      return (
        <ComingSoonPage
          title="History"
          description="Review your previous health monitoring sessions."
          icon="◷"
        />
      );
    }


    if (
      activePage === "Reports"
    ) {

      return (
        <ComingSoonPage
          title="Reports"
          description="View and manage your health monitoring reports."
          icon="▤"
        />
      );
    }


    if (
      activePage === "Profile"
    ) {

      return (
        <ComingSoonPage
          title="Profile"
          description="Your personal profile will be available here."
          icon="●"
        />
      );
    }


    if (
      activePage === "Settings"
    ) {

      return (
        <ComingSoonPage
          title="Settings"
          description="Manage your VitalCare monitoring preferences."
          icon="⚙"
        />
      );
    }


    return (
      <Dashboard />
    );
  };


  // ============================================================
  // APPLICATION
  // ============================================================

  return (

    <div className="app">


      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside className="sidebar">


        {/* ====================================================
            BRAND
        ==================================================== */}

        <div className="sidebar-brand">

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


        {/* ====================================================
            MAIN MENU
        ==================================================== */}

        <div className="sidebar-section">

          <p className="sidebar-section-title">
            MAIN MENU
          </p>


          <nav className="sidebar-nav">

            {navigationItems
              .slice(0, 5)
              .map((item) => (

                <button
                  key={item.name}
                  className={`sidebar-nav-item ${
                    activePage === item.name
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    handleNavigation(
                      item.name
                    )
                  }
                >

                  <span className="sidebar-nav-icon">
                    {item.icon}
                  </span>

                  <span>
                    {item.name}
                  </span>

                </button>

              ))}

          </nav>

        </div>


        {/* ====================================================
            ACCOUNT
        ==================================================== */}

        <div className="sidebar-section account-section">

          <p className="sidebar-section-title">
            ACCOUNT
          </p>


          <nav className="sidebar-nav">

            {navigationItems
              .slice(5)
              .map((item) => (

                <button
                  key={item.name}
                  className={`sidebar-nav-item ${
                    activePage === item.name
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    handleNavigation(
                      item.name
                    )
                  }
                >

                  <span className="sidebar-nav-icon">
                    {item.icon}
                  </span>

                  <span>
                    {item.name}
                  </span>

                </button>

              ))}

          </nav>

        </div>


        {/* ====================================================
            DEVICE STATUS
        ==================================================== */}

        <div className="sidebar-device-card">

          <p className="sidebar-section-title">
            MONITORING DEVICE
          </p>


          <div className="sidebar-device-status">

            <span
              className={`device-dot ${
                connected
                  ? "online"
                  : "offline"
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


      {/* ======================================================
          MAIN AREA
      ====================================================== */}

      <div className="main-area">


        {/* ====================================================
            TOPBAR
        ==================================================== */}

        <header className="topbar">


          <div className="topbar-spacer"></div>


          <div className="header-actions">


            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() =>
                setActivePage(
                  "Risk & Alerts"
                )
              }
            >

              <span>
                🔔
              </span>

            </button>


            <button
              className="profile-button"
              onClick={() =>
                setActivePage(
                  "Profile"
                )
              }
            >

              <span className="profile-avatar">
                P
              </span>


              <span className="profile-name">
                Profile
              </span>


              <span className="chevron">
                ˅
              </span>

            </button>

          </div>

        </header>


        {/* ====================================================
            PAGE CONTENT
        ==================================================== */}

        <main>

          {renderPage()}

        </main>


        {/* ====================================================
            FOOTER
        ==================================================== */}

        <footer>

          <span>
            VitalCare Smart Health Monitoring
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