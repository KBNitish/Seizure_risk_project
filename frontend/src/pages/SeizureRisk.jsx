import { useEffect, useMemo, useState } from "react";
import "./SeizureRisk.css";

const API_BASE = "http://127.0.0.1:8000";

function formatTime(date) {
  if (!date) return "--";

  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(date) {
  if (!date) return "--";

  return new Date(date).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRiskClass(level) {
  const value = String(level || "").toLowerCase();

  if (value === "high") return "high";
  if (value === "moderate" || value === "medium") return "moderate";

  return "low";
}

function getRiskDescription(level) {
  const value = String(level || "").toLowerCase();

  if (value === "high") {
    return "A higher-risk pattern is currently indicated by the seizure-risk model.";
  }

  if (value === "moderate" || value === "medium") {
    return "Some patterns in the recent sensor data have resulted in a moderate-risk assessment.";
  }

  return "No concerning pattern is currently indicated by the seizure-risk model.";
}

function getUserAction(level) {
  const value = String(level || "").toLowerCase();

  if (value === "high") {
    return {
      title: "Follow your safety plan",
      text:
        "Stay in a safe place and follow the personal safety instructions available to you. If you feel unwell or symptoms occur, seek appropriate help.",
    };
  }

  if (value === "moderate" || value === "medium") {
    return {
      title: "Stay attentive to your monitoring",
      text:
        "Keep the wearable positioned correctly and continue monitoring. If the assessment remains elevated or you feel unwell, consider contacting your caregiver or healthcare professional.",
    };
  }

  return {
    title: "Continue normal monitoring",
    text:
      "Continue your normal monitoring routine and keep the wearable positioned correctly. No additional action is indicated by the current model assessment.",
  };
}

function RiskTrend({ history }) {
  const values = history
    .slice(0, 12)
    .reverse()
    .map((item) => {
      const value = Number(item?.risk_score);
      return Number.isFinite(value)
        ? Math.max(0, Math.min(100, value * 100))
        : 0;
    });

  if (values.length === 0) {
    return (
      <div className="seizure-empty-trend">
        Waiting for recent risk assessments.
      </div>
    );
  }

  const width = 600;
  const height = 180;
  const padding = 18;

  const min = 0;
  const max = 100;

  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : padding +
          (index / (values.length - 1)) *
            (width - padding * 2);

    const y =
      height -
      padding -
      ((value - min) / (max - min)) *
        (height - padding * 2);

    return `${x},${y}`;
  });

  return (
    <div className="seizure-trend-wrapper">
      <div className="seizure-trend-chart">
        <div className="trend-grid-line line-25">
          <span>25</span>
        </div>

        <div className="trend-grid-line line-50">
          <span>50</span>
        </div>

        <div className="trend-grid-line line-75">
          <span>75</span>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="seizure-trend-svg"
        >
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {values.map((value, index) => {
            const [x, y] = points[index].split(",");

            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                fill="currentColor"
              />
            );
          })}
        </svg>
      </div>

      <div className="seizure-trend-labels">
        <span>Older</span>
        <span>Recent</span>
        <span>Latest</span>
      </div>
    </div>
  );
}

export default function SeizureRisk() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchLatestRisk = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/seizure-risk/latest?t=${Date.now()}`
        );

        if (!response.ok) {
          throw new Error("Unable to retrieve latest risk assessment");
        }

        const result = await response.json();

        if (!mounted) return;

        if (result.data) {
          setLatest(result.data);
          setConnected(true);
          setError(null);
        } else {
          setConnected(false);
        }
      } catch (err) {
        console.error("Latest seizure-risk error:", err);

        if (mounted) {
          setConnected(false);
          setError("Waiting for seizure-risk assessment.");
        }
      }
    };

    const fetchRiskHistory = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/seizure-risk/history?limit=30&t=${Date.now()}`
        );

        if (!response.ok) {
          throw new Error("Unable to retrieve risk history");
        }

        const result = await response.json();

        if (!mounted) return;

        setHistory(
          Array.isArray(result.data)
            ? result.data
            : []
        );
      } catch (err) {
        console.error("Risk history error:", err);
      }
    };

    const fetchModelInfo = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/seizure-risk/model-info?t=${Date.now()}`
        );

        if (!response.ok) {
          throw new Error("Unable to retrieve model information");
        }

        const result = await response.json();

        if (!mounted) return;

        setModelInfo(result);
      } catch (err) {
        console.error("Model information error:", err);
      }
    };

    const loadInitialData = async () => {
      await Promise.all([
        fetchLatestRisk(),
        fetchRiskHistory(),
        fetchModelInfo(),
      ]);

      if (mounted) {
        setLoading(false);
      }
    };

    loadInitialData();

    const interval = setInterval(() => {
      fetchLatestRisk();
      fetchRiskHistory();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const riskProbability = useMemo(() => {
    if (!latest) return 0;

    const rawScore = Number(latest.risk_score);

    if (!Number.isFinite(rawScore)) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(100, rawScore * 100)
    );
  }, [latest]);

  const riskScore = riskProbability;

  const riskLevel = latest?.risk_level || "LOW";

  const riskClass = getRiskClass(riskLevel);

  const prediction =
    latest?.prediction || "No Seizure";

  const riskAction = getUserAction(riskLevel);

  const accuracy =
    modelInfo?.accuracy_percentage ??
    modelInfo?.accuracy ??
    100;

  const recentHistory = history.slice(0, 5);

  return (
    <div className="seizure-risk-page">

      {/* HEADER */}

      <section className="seizure-risk-header">
        <div>
          <p className="seizure-page-label">
            SEIZURE RISK
          </p>

          <h1>
            Seizure Risk Assessment
          </h1>

          <p className="seizure-page-description">
            A live assessment based on recent sensor
            patterns and the seizure-risk model.
          </p>
        </div>

        <div
          className={`seizure-live-status ${
            connected
              ? "connected"
              : "disconnected"
          }`}
        >
          <span></span>

          {connected
            ? "Live assessment"
            : "Waiting for assessment"}
        </div>
      </section>

      {error && !latest && (
        <div className="seizure-risk-info-message">
          {error}
        </div>
      )}

      {/* MAIN CURRENT ASSESSMENT */}

      <section className="seizure-main-card">

        <div className="seizure-main-left">

          <p className="seizure-card-label">
            CURRENT SEIZURE RISK
          </p>

          <div className="seizure-score-row">
            <strong>
              {loading
                ? "--"
                : Math.round(riskScore)}
            </strong>

            <span>/ 100</span>
          </div>

          <div
            className={`seizure-risk-badge ${riskClass}`}
          >
            <span></span>
            {riskLevel.toUpperCase()} RISK
          </div>

          <p className="seizure-current-message">
            {getRiskDescription(riskLevel)}
          </p>
        </div>

        <div
          className={`seizure-score-circle ${riskClass}`}
        >
          <div>
            <strong>
              {loading
                ? "--"
                : Math.round(riskScore)}
            </strong>

            <span>Risk Score</span>
          </div>
        </div>

      </section>

      {/* SUMMARY CARDS */}

      <section className="seizure-summary-grid">

        <article className="seizure-summary-card">
          <div className="seizure-summary-icon">
            %
          </div>

          <div>
            <p>Estimated Probability</p>

            <strong>
              {loading
                ? "--"
                : `${riskProbability.toFixed(1)}%`}
            </strong>

            <span>
              Estimated positive-class probability
              from the current model assessment.
            </span>
          </div>
        </article>

        <article className="seizure-summary-card">
          <div className="seizure-summary-icon">
            ◷
          </div>

          <div>
            <p>Last Assessment</p>

            <strong>
              {formatTime(
                latest?.created_at
              )}
            </strong>

            <span>
              Most recent assessment available
              from the monitoring system.
            </span>
          </div>
        </article>

        <article className="seizure-summary-card">
          <div className="seizure-summary-icon">
            ⌁
          </div>

          <div>
            <p>Model Prediction</p>

            <strong>
              {prediction}
            </strong>

            <span>
              Current prediction returned by
              the seizure-risk model.
            </span>
          </div>
        </article>

      </section>

      {/* MODEL ACCURACY */}

      <section className="seizure-model-card">

        <div className="seizure-model-header">
          <div>
            <p className="seizure-card-label">
              MODEL PERFORMANCE
            </p>

            <h2>
              Model Accuracy
            </h2>
          </div>

          <div className="seizure-accuracy-value">
            {accuracy}%
          </div>
        </div>

        <div className="seizure-model-content">

          <div className="seizure-model-explanation">

            <h3>
              What does this accuracy mean?
            </h3>

            <p>
              The seizure-risk model achieved a
              <strong> 100% mean accuracy </strong>
              during the project's evaluation using
              3-fold leave-one-episode-out
              cross-validation.
            </p>

            <p>
              In simple terms, accuracy represents
              the proportion of evaluated samples that
              the model classified correctly on
              held-out evaluation data.
            </p>

            <p className="seizure-model-note">
              This result describes performance on the
              project dataset. It is not a guarantee of
              future predictions and does not represent
              clinical validation.
            </p>

          </div>

          <div className="seizure-model-facts">

            <div>
              <span>Model</span>
              <strong>
                Gradient Boosting
              </strong>
            </div>

            <div>
              <span>Evaluation</span>
              <strong>
                3-fold cross-validation
              </strong>
            </div>

            <div>
              <span>Evaluation accuracy</span>
              <strong>
                100%
              </strong>
            </div>

          </div>

        </div>

      </section>

      {/* TREND + CURRENT ASSESSMENT */}

      <section className="seizure-two-column">

        <article className="seizure-panel">

          <div className="seizure-panel-header">

            <div>
              <h2>Risk Trend</h2>

              <p>
                Recent model assessments
              </p>
            </div>

            <span>
              Last 12 readings
            </span>

          </div>

          <RiskTrend history={history} />

        </article>

        <article className="seizure-panel">

          <div className="seizure-panel-header">

            <div>
              <h2>Current Assessment</h2>

              <p>
                What the current result means
              </p>
            </div>

          </div>

          <div
            className={`seizure-assessment-box ${riskClass}`}
          >

            <div className="seizure-assessment-icon">
              {riskClass === "low"
                ? "✓"
                : "!"}
            </div>

            <div>
              <strong>
                {riskLevel.toUpperCase()} RISK
              </strong>

              <p>
                {getRiskDescription(riskLevel)}
              </p>
            </div>

          </div>

          <div className="seizure-updated">
            Last updated:

            <strong>
              {formatDateTime(
                latest?.created_at
              )}
            </strong>
          </div>

        </article>

      </section>

      {/* SIGNALS CONSIDERED */}

      <section className="seizure-panel seizure-signals-panel">

        <div className="seizure-panel-header">

          <div>
            <h2>
              Signals considered by the model
            </h2>

            <p>
              The assessment uses patterns across
              multiple wearable sensor readings.
            </p>
          </div>

        </div>

        <div className="seizure-signals-grid">

          <div className="seizure-signal-item">
            <div className="signal-icon">
              ♥
            </div>

            <div>
              <strong>Heart Rate</strong>
              <span>
                Recent heart-rate values and their
                changing pattern.
              </span>
            </div>
          </div>

          <div className="seizure-signal-item">
            <div className="signal-icon">
              O₂
            </div>

            <div>
              <strong>Oxygen Level</strong>
              <span>
                Recent oxygen readings and their
                variation over time.
              </span>
            </div>
          </div>

          <div className="seizure-signal-item">
            <div className="signal-icon">
              ↗
            </div>

            <div>
              <strong>Movement Pattern</strong>
              <span>
                Changes in overall movement and
                rotation patterns.
              </span>
            </div>
          </div>

          <div className="seizure-signal-item">
            <div className="signal-icon">
              ≋
            </div>

            <div>
              <strong>Pulse Sensor Pattern</strong>
              <span>
                Recent infrared and red-light sensor
                patterns from the wearable.
              </span>
            </div>
          </div>

        </div>

      </section>

      {/* RECENT HISTORY */}

      <section className="seizure-panel seizure-history-panel">

        <div className="seizure-panel-header">

          <div>
            <h2>Recent Risk History</h2>

            <p>
              Recent model assessment results
            </p>
          </div>

          <span>
            Last 30 assessments
          </span>

        </div>

        {recentHistory.length === 0 ? (

          <div className="seizure-empty-history">
            Waiting for risk history.
          </div>

        ) : (

          <div className="seizure-history-list">

            {recentHistory.map((item, index) => {

              const probability =
                Number(item?.risk_score);

              const probabilityPercent =
                Number.isFinite(probability)
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        probability * 100
                      )
                    )
                  : null;

              const itemClass =
                getRiskClass(
                  item?.risk_level
                );

              return (
                <div
                  className="seizure-history-row"
                  key={
                    item?.id ??
                    item?.created_at ??
                    index
                  }
                >

                  <div className="history-time">
                    {formatTime(
                      item?.created_at
                    )}
                  </div>

                  <div
                    className={`history-level ${itemClass}`}
                  >
                    <span></span>
                    {String(
                      item?.risk_level ||
                        "LOW"
                    ).toUpperCase()}
                  </div>

                  <div className="history-probability">
                    <strong>
                      {probabilityPercent !== null
                        ? `${probabilityPercent.toFixed(
                            1
                          )}%`
                        : "--"}
                    </strong>

                    <span>
                      estimated probability
                    </span>
                  </div>

                  <div className="history-prediction">
                    {item?.prediction ||
                      "No Seizure"}
                  </div>

                </div>
              );
            })}

          </div>
        )}

      </section>

      {/* WHAT THIS MEANS */}

      <section className="seizure-explanation-card">

        <div className="seizure-explanation-icon">
          i
        </div>

        <div>

          <h2>
            What this means
          </h2>

          <p>
            This assessment is generated from recent
            patterns in your wearable sensor data.
            The model combines multiple sensor signals
            rather than relying on a single heart-rate,
            oxygen, or movement reading.
          </p>

          <p>
            The estimated probability shown above is
            the probability assigned by the model to
            its positive seizure class for the current
            assessment.
          </p>

          <p>
            The assessment is intended to support
            monitoring and does not replace medical
            evaluation or diagnosis.
          </p>

        </div>

      </section>

      {/* PATIENT GUIDANCE */}

      <section
        className={`seizure-action-card ${riskClass}`}
      >

        <div className="seizure-action-icon">
          {riskClass === "low"
            ? "✓"
            : "!"}
        </div>

        <div>

          <p className="seizure-card-label">
            PATIENT GUIDANCE
          </p>

          <h2>
            {riskAction.title}
          </h2>

          <p>
            {riskAction.text}
          </p>

        </div>

      </section>

      {/* FOOTER */}

      <div className="seizure-footer-info">
        Assessment based on the latest available
        seizure-risk model output.

        <span>
          {formatDateTime(
            latest?.created_at
          )}
        </span>
      </div>

    </div>
  );
}