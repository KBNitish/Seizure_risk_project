import { useEffect, useMemo, useState } from "react";
import "./MyHealth.css";

const API_URL = "http://127.0.0.1:8000/sensor-data/latest";

const MAX_HISTORY_POINTS = 300;

function MyHealth() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("Today");

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
        const sensorData = result.data;
        const timestamp = new Date();

        setData(sensorData);
        setConnected(true);

        setHistory((previous) => {
          const newPoint = {
            timestamp,
            heartRate: Number(sensorData.heart_rate),
            spo2: Number(sensorData.spo2),
            temperature: Number(sensorData.temperature),
            fingerDetected:
              sensorData.finger_detected === true,
          };

          const updated = [...previous, newPoint];

          return updated.slice(-MAX_HISTORY_POINTS);
        });
      }
    } catch (error) {
      console.error("My Health API error:", error);
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
        timer = setTimeout(poll, 1000);
      }
    };

    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const value = (number, decimals = 1) => {
    if (
      number === null ||
      number === undefined ||
      Number.isNaN(Number(number))
    ) {
      return "--";
    }

    return Number(number).toFixed(decimals);
  };

  const currentHeartRate = data?.heart_rate;
  const currentSpo2 = data?.spo2;
  const currentTemperature = data?.temperature;
  const fingerDetected = data?.finger_detected === true;

  const heartRateRange = useMemo(() => {
    const values = history
      .map((item) => item.heartRate)
      .filter((item) => Number.isFinite(item));

    if (!values.length) {
      return { min: null, max: null };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [history]);

  const spo2Range = useMemo(() => {
    const values = history
      .map((item) => item.spo2)
      .filter((item) => Number.isFinite(item));

    if (!values.length) {
      return { min: null, max: null };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [history]);

  const temperatureRange = useMemo(() => {
    const values = history
      .map((item) => item.temperature)
      .filter((item) => Number.isFinite(item));

    if (!values.length) {
      return { min: null, max: null };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [history]);

  const averageHeartRate = useMemo(() => {
    const values = history
      .map((item) => item.heartRate)
      .filter((item) => Number.isFinite(item));

    if (!values.length) {
      return null;
    }

    return (
      values.reduce((sum, item) => sum + item, 0) /
      values.length
    );
  }, [history]);

  const averageSpo2 = useMemo(() => {
    const values = history
      .map((item) => item.spo2)
      .filter((item) => Number.isFinite(item));

    if (!values.length) {
      return null;
    }

    return (
      values.reduce((sum, item) => sum + item, 0) /
      values.length
    );
  }, [history]);

  const averageTemperature = useMemo(() => {
    const values = history
      .map((item) => item.temperature)
      .filter((item) => Number.isFinite(item));

    if (!values.length) {
      return null;
    }

    return (
      values.reduce((sum, item) => sum + item, 0) /
      values.length
    );
  }, [history]);

  const unusualPeriods = useMemo(() => {
    return history.filter((item) => {
      if (!Number.isFinite(item.heartRate)) {
        return false;
      }

      return (
        item.heartRate < 50 ||
        item.heartRate > 100
      );
    }).length;
  }, [history]);

  const healthPattern = useMemo(() => {
    if (!history.length) {
      return "Waiting";
    }

    if (unusualPeriods === 0) {
      return "Stable";
    }

    if (unusualPeriods <= 5) {
      return "Mostly stable";
    }

    return "Variable";
  }, [history.length, unusualPeriods]);

  const heartRateInsight = useMemo(() => {
    if (!history.length) {
      return "Waiting for enough readings to analyse your heart-rate pattern.";
    }

    if (heartRateRange.min === null) {
      return "Heart-rate data is not available yet.";
    }

    const variation =
      heartRateRange.max - heartRateRange.min;

    if (variation <= 10) {
      return "Your recent heart-rate readings have remained fairly consistent.";
    }

    if (variation <= 25) {
      return "Your heart rate has shown some variation during monitoring.";
    }

    return "Your heart-rate readings have shown noticeable variation during this session.";
  }, [history.length, heartRateRange]);

  const spo2Insight = useMemo(() => {
    if (!history.length) {
      return "Waiting for enough readings to analyse your oxygen pattern.";
    }

    if (spo2Range.min === null) {
      return "Oxygen data is not available yet.";
    }

    if (spo2Range.min >= 95) {
      return "Your recent oxygen readings have remained consistently high.";
    }

    if (spo2Range.min >= 92) {
      return "Your oxygen readings have shown some variation during monitoring.";
    }

    return "Some oxygen readings were lower than the recent observed pattern.";
  }, [history.length, spo2Range]);

  const temperatureInsight = useMemo(() => {
    if (!history.length) {
      return "Waiting for enough readings to analyse the temperature pattern.";
    }

    if (temperatureRange.min === null) {
      return "Temperature data is not available yet.";
    }

    const variation =
      temperatureRange.max - temperatureRange.min;

    if (variation <= 0.5) {
      return "The temperature readings have remained relatively consistent.";
    }

    return "The temperature readings have shown some variation during monitoring.";
  }, [history.length, temperatureRange]);

  const chartPath = useMemo(() => {
    if (!history.length) {
      return "";
    }

    const points = history
      .filter((item) => Number.isFinite(item.heartRate))
      .slice(-80);

    if (!points.length) {
      return "";
    }

    const width = 800;
    const height = 230;

    const values = points.map((item) => item.heartRate);

    let min = Math.min(...values);
    let max = Math.max(...values);

    if (min === max) {
      min -= 10;
      max += 10;
    } else {
      const padding = (max - min) * 0.2;
      min -= padding;
      max += padding;
    }

    return points
      .map((item, index) => {
        const x =
          points.length === 1
            ? 0
            : (index / (points.length - 1)) * width;

        const normalized =
          (item.heartRate - min) / (max - min);

        const y = height - normalized * height;

        return `${index === 0 ? "M" : "L"} ${x.toFixed(
          1
        )} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [history]);

  const monitoringTime = useMemo(() => {
    if (history.length < 2) {
      return "--";
    }

    const first = history[0].timestamp;
    const last = history[history.length - 1].timestamp;

    const seconds =
      (last.getTime() - first.getTime()) / 1000;

    if (seconds < 60) {
      return `${Math.max(1, Math.round(seconds))} sec`;
    }

    return `${Math.floor(seconds / 60)} min`;
  }, [history]);

  return (
    <div className="my-health-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <section className="my-health-header">

        <div>

          <p className="my-health-label">
            PERSONAL HEALTH
          </p>

          <h1>
            My Health
          </h1>

          <p className="my-health-description">
            Understand your recent health patterns and how your
            readings have been changing over time.
          </p>

        </div>


        <div className="health-period-selector">

          {["Today", "7 Days", "30 Days"].map((period) => (

            <button
              key={period}
              className={
                selectedPeriod === period
                  ? "period-active"
                  : ""
              }
              onClick={() => setSelectedPeriod(period)}
            >
              {period}
            </button>

          ))}

        </div>

      </section>


      {/* =====================================================
          HEALTH OVERVIEW
      ===================================================== */}

      <section className="health-overview-card">

        <div className="health-overview-icon">
          {connected ? "✓" : "!"}
        </div>


        <div className="health-overview-content">

          <p className="overview-label">
            HEALTH OVERVIEW
          </p>

          <h2>
            {connected
              ? `Your readings are ${healthPattern.toLowerCase()}`
              : "Waiting for health data"}
          </h2>

          <p>
            {connected
              ? "VitalCare is receiving live sensor measurements and building your current health pattern."
              : "Connect the monitoring device to begin collecting health readings."}
          </p>

        </div>


        <div className="overview-score">

          <span>
            MONITORING
          </span>

          <strong>
            {connected ? "Active" : "Offline"}
          </strong>

          <small>
            {fingerDetected
              ? "Finger detected"
              : "Waiting for sensor contact"}
          </small>

        </div>

      </section>


      {/* =====================================================
          TODAY AT A GLANCE
      ===================================================== */}

      <section className="health-section">

        <div className="health-section-heading">

          <div>

            <p className="health-section-label">
              {selectedPeriod.toUpperCase()}
            </p>

            <h2>
              At a glance
            </h2>

          </div>

        </div>


        <div className="glance-grid">

          <article className="glance-card">

            <div className="glance-icon monitoring-icon">
              ◷
            </div>

            <div>

              <span>
                Monitoring time
              </span>

              <strong>
                {monitoringTime}
              </strong>

              <small>
                Current page session
              </small>

            </div>

          </article>


          <article className="glance-card">

            <div className="glance-icon readings-icon">
              ≋
            </div>

            <div>

              <span>
                Readings collected
              </span>

              <strong>
                {history.length}
              </strong>

              <small>
                Captured by My Health
              </small>

            </div>

          </article>


          <article className="glance-card">

            <div className="glance-icon stable-icon">
              ✓
            </div>

            <div>

              <span>
                Stable periods
              </span>

              <strong>
                {Math.max(
                  history.length - unusualPeriods,
                  0
                )}
              </strong>

              <small>
                Based on heart rate
              </small>

            </div>

          </article>


          <article className="glance-card">

            <div className="glance-icon event-icon">
              !
            </div>

            <div>

              <span>
                Unusual periods
              </span>

              <strong>
                {unusualPeriods}
              </strong>

              <small>
                Heart-rate variation
              </small>

            </div>

          </article>

        </div>

      </section>


      {/* =====================================================
          HEALTH TRENDS
      ===================================================== */}

      <section className="health-section">

        <div className="health-section-heading trend-heading">

          <div>

            <p className="health-section-label">
              HEALTH TRENDS
            </p>

            <h2>
              How your readings have changed
            </h2>

            <p>
              Live readings collected while this page is open
              are used to build the current trend.
            </p>

          </div>


          <div className="trend-legend">

            <span>
              <i className="legend-dot heart-dot"></i>
              Heart rate
            </span>

            <span>
              <i className="legend-dot oxygen-dot"></i>
              Oxygen
            </span>

            <span>
              <i className="legend-dot temperature-dot"></i>
              Temperature
            </span>

          </div>

        </div>


        <div className="trend-card">

          <div className="trend-card-header">

            <div>

              <span>
                HEART RATE
              </span>

              <strong>
                {value(currentHeartRate, 1)}
                <small>
                  {" "}BPM
                </small>
              </strong>

            </div>


            <div className="trend-summary">

              <span>
                Recent pattern
              </span>

              <strong>
                {healthPattern}
              </strong>

            </div>

          </div>


          <div className="health-chart">

            <div className="chart-y-labels">
              <span>100</span>
              <span>90</span>
              <span>80</span>
              <span>70</span>
              <span>60</span>
            </div>


            <div className="health-chart-area">

              <div className="health-chart-lines">

                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>

              </div>


              {chartPath ? (

                <svg
                  className="health-trend-svg"
                  viewBox="0 0 800 230"
                  preserveAspectRatio="none"
                >

                  <path
                    d={chartPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                </svg>

              ) : (

                <div className="empty-health-chart">
                  Waiting for readings...
                </div>

              )}


              <div className="chart-x-labels">

                <span>
                  Start
                </span>

                <span>
                  Recent
                </span>

                <span>
                  Now
                </span>

              </div>

            </div>

          </div>

        </div>


        {/* MINI TRENDS */}

        <div className="mini-trend-grid">


          <article className="mini-trend-card">

            <div className="mini-trend-top">

              <div>

                <span>
                  OXYGEN LEVEL
                </span>

                <strong>
                  {value(currentSpo2, 1)}
                  <small>
                    {" "}%
                  </small>
                </strong>

              </div>


              <span className="mini-trend-status">
                {currentSpo2 !== undefined &&
                currentSpo2 !== null
                  ? "Live"
                  : "Waiting"}
              </span>

            </div>


            <div className="mini-chart">

              <svg
                viewBox="0 0 500 90"
                preserveAspectRatio="none"
              >

                <path
                  d="
                    M0 50
                    C35 47, 55 53, 85 48
                    S140 43, 175 49
                    S230 54, 265 46
                    S320 43, 350 48
                    S410 51, 450 44
                    S480 46, 500 42
                  "
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

              </svg>

            </div>

          </article>


          <article className="mini-trend-card">

            <div className="mini-trend-top">

              <div>

                <span>
                  TEMPERATURE
                </span>

                <strong>
                  {value(currentTemperature, 1)}
                  <small>
                    {" "}°C
                  </small>
                </strong>

              </div>


              <span className="mini-trend-status">
                {currentTemperature !== undefined &&
                currentTemperature !== null
                  ? "Live"
                  : "Waiting"}
              </span>

            </div>


            <div className="mini-chart temperature-chart">

              <svg
                viewBox="0 0 500 90"
                preserveAspectRatio="none"
              >

                <path
                  d="
                    M0 48
                    C35 49, 60 45, 90 47
                    S145 51, 180 46
                    S235 44, 270 47
                    S325 49, 360 45
                    S420 43, 455 46
                    S480 48, 500 44
                  "
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

              </svg>

            </div>

          </article>

        </div>

      </section>


      {/* =====================================================
          PERSONAL RANGE
      ===================================================== */}

      <section className="health-section">

        <div className="health-section-heading">

          <div>

            <p className="health-section-label">
              YOUR RECENT RANGE
            </p>

            <h2>
              Your observed pattern
            </h2>

            <p>
              These values are calculated from readings collected
              during the current My Health session.
            </p>

          </div>

        </div>


        <div className="range-card">


          {/* HEART RATE */}

          <div className="range-row">

            <div className="range-name">

              <div className="range-symbol heart-symbol">
                ♥
              </div>

              <div>

                <strong>
                  Heart rate
                </strong>

                <small>
                  Beats per minute
                </small>

              </div>

            </div>


            <div className="range-value">

              <strong>
                {heartRateRange.min !== null
                  ? `${value(
                      heartRateRange.min,
                      0
                    )}–${value(
                      heartRateRange.max,
                      0
                    )}`
                  : "--"}
              </strong>

              <span>
                BPM
              </span>

            </div>


            <div className="range-bar">

              <div className="range-track">

                <span className="range-position"></span>

              </div>

              <div className="range-labels">

                <span>
                  {heartRateRange.min !== null
                    ? `Low ${value(
                        heartRateRange.min,
                        0
                      )}`
                    : "Recent low"}

                </span>

                <span>
                  {heartRateRange.max !== null
                    ? `High ${value(
                        heartRateRange.max,
                        0
                      )}`
                    : "Recent high"}

                </span>

              </div>

            </div>

          </div>


          <div className="range-divider"></div>


          {/* OXYGEN */}

          <div className="range-row">

            <div className="range-name">

              <div className="range-symbol oxygen-symbol">
                O₂
              </div>

              <div>

                <strong>
                  Oxygen level
                </strong>

                <small>
                  Blood oxygen saturation
                </small>

              </div>

            </div>


            <div className="range-value">

              <strong>
                {spo2Range.min !== null
                  ? `${value(
                      spo2Range.min,
                      0
                    )}–${value(
                      spo2Range.max,
                      0
                    )}`
                  : "--"}
              </strong>

              <span>
                %
              </span>

            </div>


            <div className="range-bar">

              <div className="range-track">

                <span className="range-position oxygen-position"></span>

              </div>

              <div className="range-labels">

                <span>
                  {spo2Range.min !== null
                    ? `Low ${value(
                        spo2Range.min,
                        0
                      )}`
                    : "Recent low"}

                </span>

                <span>
                  {spo2Range.max !== null
                    ? `High ${value(
                        spo2Range.max,
                        0
                      )}`
                    : "Recent high"}

                </span>

              </div>

            </div>

          </div>


          <div className="range-divider"></div>


          {/* TEMPERATURE */}

          <div className="range-row">

            <div className="range-name">

              <div className="range-symbol temperature-symbol">
                °
              </div>

              <div>

                <strong>
                  Temperature
                </strong>

                <small>
                  Sensor temperature reading
                </small>

              </div>

            </div>


            <div className="range-value">

              <strong>
                {temperatureRange.min !== null
                  ? `${value(
                      temperatureRange.min,
                      1
                    )}–${value(
                      temperatureRange.max,
                      1
                    )}`
                  : "--"}
              </strong>

              <span>
                °C
              </span>

            </div>


            <div className="range-bar">

              <div className="range-track">

                <span className="range-position temperature-position"></span>

              </div>

              <div className="range-labels">

                <span>
                  {temperatureRange.min !== null
                    ? `Low ${value(
                        temperatureRange.min,
                        1
                      )}`
                    : "Recent low"}

                </span>

                <span>
                  {temperatureRange.max !== null
                    ? `High ${value(
                        temperatureRange.max,
                        1
                      )}`
                    : "Recent high"}

                </span>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          HEALTH INSIGHTS
      ===================================================== */}

      <section className="health-section">

        <div className="health-section-heading">

          <div>

            <p className="health-section-label">
              HEALTH INSIGHTS
            </p>

            <h2>
              What your data is showing
            </h2>

            <p>
              Simple observations based on readings collected
              during this monitoring session.
            </p>

          </div>

        </div>


        <div className="insights-grid">


          <article className="insight-card">

            <div className="insight-icon insight-positive">
              ♥
            </div>

            <div>

              <span>
                HEART RATE
              </span>

              <h3>
                {averageHeartRate !== null
                  ? `Average ${value(
                      averageHeartRate,
                      0
                    )} BPM`
                  : "Waiting for heart-rate data"}
              </h3>

              <p>
                {heartRateInsight}
              </p>

            </div>

          </article>


          <article className="insight-card">

            <div className="insight-icon insight-positive">
              O₂
            </div>

            <div>

              <span>
                OXYGEN
              </span>

              <h3>
                {averageSpo2 !== null
                  ? `Average ${value(
                      averageSpo2,
                      0
                    )}%`
                  : "Waiting for oxygen data"}
              </h3>

              <p>
                {spo2Insight}
              </p>

            </div>

          </article>


          <article className="insight-card">

            <div className="insight-icon insight-neutral">
              °
            </div>

            <div>

              <span>
                TEMPERATURE
              </span>

              <h3>
                {averageTemperature !== null
                  ? `Average ${value(
                      averageTemperature,
                      1
                    )}°C`
                  : "Waiting for temperature data"}
              </h3>

              <p>
                {temperatureInsight}
              </p>

            </div>

          </article>

        </div>

      </section>


      {/* =====================================================
          DAILY TIMELINE
      ===================================================== */}

      <section className="health-section timeline-section">

        <div className="health-section-heading">

          <div>

            <p className="health-section-label">
              MONITORING SESSION
            </p>

            <h2>
              Activity timeline
            </h2>

            <p>
              A simple view of how the current monitoring
              session has progressed.
            </p>

          </div>

        </div>


        <div className="timeline-card">


          <div className="timeline-item">

            <div className="timeline-marker timeline-start">
              ✓
            </div>

            <div className="timeline-line"></div>

            <div className="timeline-content">

              <strong>
                Monitoring session started
              </strong>

              <p>
                My Health began collecting live readings.
              </p>

            </div>

            <span className="timeline-time">
              {history.length
                ? history[0].timestamp.toLocaleTimeString()
                : "--"}
            </span>

          </div>


          <div className="timeline-item">

            <div className="timeline-marker timeline-normal">
              ●
            </div>

            <div className="timeline-line"></div>

            <div className="timeline-content">

              <strong>
                Live readings collected
              </strong>

              <p>
                {history.length
                  ? `${history.length} sensor readings have been collected during this session.`
                  : "Waiting for sensor readings."}
              </p>

            </div>

            <span className="timeline-time">
              {connected ? "Active" : "Offline"}
            </span>

          </div>


          <div className="timeline-item timeline-last">

            <div className="timeline-marker timeline-normal">
              ✓
            </div>

            <div className="timeline-content">

              <strong>
                Latest monitoring state
              </strong>

              <p>
                {fingerDetected
                  ? "Finger detected and sensor readings are being received."
                  : "Place your finger on the sensor to continue collecting pulse and oxygen readings."}
              </p>

            </div>

            <span className="timeline-time">
              {data
                ? new Date().toLocaleTimeString()
                : "--"}
            </span>

          </div>

        </div>

      </section>


      {/* =====================================================
          HEALTH NOTE
      ===================================================== */}

      <div className="health-note">

        <span className="health-note-icon">
          i
        </span>

        <p>
          My Health uses readings collected during the current
          page session. Longer-term 7-day and 30-day history
          will require persistent historical data from the
          backend database.
        </p>

      </div>

    </div>
  );
}

export default MyHealth;