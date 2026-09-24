import { useEffect, useMemo, useState } from "react";
import "./History.css";

const API_BASE = "http://127.0.0.1:8000";

function History() {
  const [readings, setReadings] = useState([]);
  const [riskHistory, setRiskHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const [healthResponse, riskResponse] = await Promise.all([
          fetch(`${API_BASE}/health-history?limit=50`),
          fetch(`${API_BASE}/seizure-risk/history?limit=30`)
        ]);

        const healthResult = await healthResponse.json();
        const riskResult = await riskResponse.json();

        setReadings(healthResult.data || []);
        setRiskHistory(riskResult.data || []);
      } catch (error) {
        console.error("History loading error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const stats = useMemo(() => {
    if (!readings.length) {
      return {
        avgHeartRate: "--",
        avgSpo2: "--",
        avgTemperature: "--",
        totalReadings: 0
      };
    }

    const average = (key) => {
      const values = readings
        .map((item) => Number(item[key]))
        .filter((value) => !Number.isNaN(value));

      if (!values.length) return "--";

      return (
        values.reduce((sum, value) => sum + value, 0) / values.length
      ).toFixed(1);
    };

    return {
      avgHeartRate: average("heart_rate"),
      avgSpo2: average("spo2"),
      avgTemperature: average("temperature"),
      totalReadings: readings.length
    };
  }, [readings]);

  const formatTime = (timestamp) => {
    if (!timestamp) return "--";

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) return "--";

    return date.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  const riskPercentage = (score) => {
    const value = Number(score);

    if (Number.isNaN(value)) return "--";

    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="history-page">
        <div className="history-header">
          <div>
            <p className="page-label">VITALCARE</p>
            <h1>History</h1>
            <p>
              Review your previous health monitoring readings and
              risk assessments.
            </p>
          </div>
        </div>

        <div className="history-loading">
          Loading your monitoring history...
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">

      {/* HEADER */}
      <section className="history-header">
        <div>
          <p className="page-label">HEALTH HISTORY</p>
          <h1>Your monitoring history</h1>
          <p>
            Review your recent health readings and seizure-risk
            assessments recorded by VitalCare.
          </p>
        </div>

        <div className="history-live-pill">
          <span></span>
          Data from monitoring system
        </div>
      </section>

      {/* SUMMARY */}
      <section className="history-summary">

        <article className="history-stat-card">
          <div className="history-stat-icon heart">♥</div>
          <div>
            <span>Average Heart Rate</span>
            <strong>
              {stats.avgHeartRate}
              <small> BPM</small>
            </strong>
          </div>
        </article>

        <article className="history-stat-card">
          <div className="history-stat-icon oxygen">O₂</div>
          <div>
            <span>Average Oxygen</span>
            <strong>
              {stats.avgSpo2}
              <small> %</small>
            </strong>
          </div>
        </article>

        <article className="history-stat-card">
          <div className="history-stat-icon temperature">°</div>
          <div>
            <span>Room Temperature</span>
            <strong>
              {stats.avgTemperature}
              <small> °C</small>
            </strong>
          </div>
        </article>

        <article className="history-stat-card">
          <div className="history-stat-icon readings">◷</div>
          <div>
            <span>Recorded Readings</span>
            <strong>{stats.totalReadings}</strong>
          </div>
        </article>

      </section>

      {/* HEALTH READINGS */}
      <section className="history-section">

        <div className="history-section-header">
          <div>
            <p className="section-label">HEALTH DATA</p>
            <h2>Recent readings</h2>
          </div>

          <span className="history-count">
            {readings.length} readings
          </span>
        </div>

        <div className="history-table-wrapper">

          {readings.length === 0 ? (
            <div className="history-empty">
              <div>◷</div>
              <h3>No health history yet</h3>
              <p>
                Your readings will appear here once the monitoring
                device starts sending data.
              </p>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Heart Rate</th>
                  <th>SpO₂</th>
                  <th>Room Temperature</th>
                  <th>Humidity</th>
                </tr>
              </thead>

              <tbody>
                {readings.slice(0, 20).map((reading, index) => (
                  <tr key={`${reading.created_at}-${index}`}>
                    <td>{formatTime(reading.created_at)}</td>

                    <td>
                      <strong>
                        {reading.heart_rate?.toFixed(0) ?? "--"}
                      </strong>
                      <span className="unit"> BPM</span>
                    </td>

                    <td>
                      <strong>
                        {reading.spo2?.toFixed(0) ?? "--"}
                      </strong>
                      <span className="unit">%</span>
                    </td>

                    <td>
                      {reading.temperature?.toFixed(1) ?? "--"}
                      <span className="unit"> °C</span>
                    </td>

                    <td>
                      {reading.humidity?.toFixed(0) ?? "--"}
                      <span className="unit">%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        </div>
      </section>

      {/* SEIZURE RISK HISTORY */}
      <section className="history-section">

        <div className="history-section-header">
          <div>
            <p className="section-label">SAFETY MONITOR</p>
            <h2>Seizure-risk history</h2>
          </div>

          <span className="history-count">
            {riskHistory.length} assessments
          </span>
        </div>

        <div className="risk-history-list">

          {riskHistory.length === 0 ? (
            <div className="history-empty">
              <div>⌁</div>
              <h3>No risk assessments yet</h3>
              <p>
                Risk assessments will appear here after the model
                begins producing predictions.
              </p>
            </div>
          ) : (
            riskHistory.slice(0, 10).map((risk, index) => (
              <div
                className="risk-history-item"
                key={`${risk.created_at}-${index}`}
              >

                <div className="risk-history-time">
                  <strong>
                    {formatTime(risk.created_at)}
                  </strong>
                </div>

                <div className="risk-history-level">
                  <span
                    className={`risk-dot ${
                      String(risk.risk_level).toLowerCase()
                    }`}
                  ></span>

                  <div>
                    <strong>{risk.risk_level}</strong>
                    <small>{risk.prediction}</small>
                  </div>
                </div>

                <div className="risk-history-score">
                  <strong>
                    {riskPercentage(risk.risk_score)}
                  </strong>
                  <span>Estimated probability</span>
                </div>

              </div>
            ))
          )}

        </div>
      </section>

      {/* NOTE */}
      <section className="history-note">
        <div className="history-note-icon">i</div>

        <div>
          <strong>About your history</strong>
          <p>
            These records are collected from your monitoring system
            and are intended to help you understand changes over
            time. They are not a substitute for professional medical
            evaluation.
          </p>
        </div>
      </section>

    </div>
  );
}

export default History;