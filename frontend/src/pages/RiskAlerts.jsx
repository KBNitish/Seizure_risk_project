import { useEffect, useMemo, useState } from "react";
import "./RiskAlerts.css";

const API_URL = "http://127.0.0.1:8000/sensor-data/latest";

const HISTORY_LIMIT = 180;
const PERSISTENCE_REQUIRED = 4;

function RiskAlerts() {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);

  /*
   * =========================================================
   * FETCH LIVE SENSOR DATA
   * =========================================================
   */

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
        const now = new Date();

        const reading = {
          ...result.data,
          timestamp: now,
        };

        setData(result.data);
        setConnected(true);
        setLastUpdated(now);

        setHistory((previous) => {
          const updated = [...previous, reading];

          return updated.slice(-HISTORY_LIMIT);
        });
      }
    } catch (error) {
      console.error("Risk & Alerts API error:", error);
      setConnected(false);
    }
  };

  /*
   * =========================================================
   * LIVE POLLING
   * =========================================================
   *
   * The first request is delayed by one event cycle so that
   * React does not report a synchronous state update inside
   * the effect.
   */

  useEffect(() => {
    const initialFetch = setTimeout(() => {
      fetchSensorData();
    }, 0);

    const interval = setInterval(() => {
      fetchSensorData();
    }, 1000);

    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, []);

  /*
   * =========================================================
   * CLASSIFY SENSOR READING
   * =========================================================
   *
   * IMPORTANT:
   * These are monitoring thresholds only.
   *
   * They do NOT predict or detect seizures.
   */

  const classifyReading = (reading) => {
    const hr = Number(reading?.heart_rate);
    const oxygen = Number(reading?.spo2);

    const reasons = [];

    /*
     * HEART RATE
     */

    if (Number.isFinite(hr)) {
      if (hr < 45 || hr > 120) {
        reasons.push({
          category: "Heart rate",
          title: "Heart rate changed significantly",
          value: `${hr.toFixed(0)} BPM`,
          severity: "attention",
          reason:
            hr < 45
              ? "The heart rate was below the current monitoring range."
              : "The heart rate was above the current monitoring range.",
        });
      } else if (hr < 50 || hr > 100) {
        reasons.push({
          category: "Heart rate",
          title: "Heart rate variation noticed",
          value: `${hr.toFixed(0)} BPM`,
          severity: "change",
          reason:
            hr < 50
              ? "The heart rate was below the usual monitoring range."
              : "The heart rate was above the usual monitoring range.",
        });
      }
    }

    /*
     * OXYGEN
     */

    if (Number.isFinite(oxygen) && oxygen < 94) {
      reasons.push({
        category: "Oxygen",
        title: "Oxygen level changed",
        value: `${oxygen.toFixed(0)}%`,
        severity: "attention",
        reason:
          "The oxygen reading was below the current monitoring threshold.",
      });
    }

    /*
     * MOVEMENT
     */

    const acceleration = Math.sqrt(
      Math.pow(Number(reading?.accel_x) || 0, 2) +
        Math.pow(Number(reading?.accel_y) || 0, 2) +
        Math.pow(Number(reading?.accel_z) || 0, 2)
    );

    const rotation = Math.sqrt(
      Math.pow(Number(reading?.gyro_x) || 0, 2) +
        Math.pow(Number(reading?.gyro_y) || 0, 2) +
        Math.pow(Number(reading?.gyro_z) || 0, 2)
    );

    if (acceleration > 2.5 || rotation > 300) {
      reasons.push({
        category: "Movement",
        title: "Unusual movement noticed",
        value: "Motion pattern changed",
        severity: "change",
        reason:
          "The motion sensors recorded movement above the current monitoring threshold.",
      });
    }

    return reasons;
  };

  /*
   * =========================================================
   * CREATE MEANINGFUL MONITORING EPISODES
   * =========================================================
   *
   * Example:
   *
   * 166
   * 166
   * 166
   * 166
   * 166
   *
   * becomes ONE monitoring episode.
   *
   * A single temporary abnormal reading is ignored.
   */

  const monitoringEpisodes = useMemo(() => {
    const episodes = [];

    let activeEpisode = null;

    history.forEach((reading, index) => {
      const reasons = classifyReading(reading);

      /*
       * NORMAL READING
       */

      if (reasons.length === 0) {
        if (activeEpisode) {
          /*
           * Only keep the episode if the abnormal pattern
           * persisted for the required number of readings.
           */

          if (
            activeEpisode.durationReadings >=
            PERSISTENCE_REQUIRED
          ) {
            episodes.push({
              ...activeEpisode,
              resolved: true,
              resolvedAt: reading.timestamp,
            });
          }

          activeEpisode = null;
        }

        return;
      }

      /*
       * Pick the strongest monitoring signal.
       */

      const strongestReason =
        reasons.find(
          (reason) => reason.severity === "attention"
        ) || reasons[0];

      /*
       * START NEW EPISODE
       */

      if (!activeEpisode) {
        activeEpisode = {
          id: `episode-${index}`,
          category: strongestReason.category,
          title: strongestReason.title,
          value: strongestReason.value,
          reason: strongestReason.reason,
          severity: strongestReason.severity,
          startedAt: reading.timestamp,
          lastSeenAt: reading.timestamp,
          durationReadings: 1,
          readings: [reading],
          reasons,
          resolved: false,
        };

        return;
      }

      /*
       * CONTINUE SAME EPISODE
       */

      const sameCategory =
        activeEpisode.category ===
        strongestReason.category;

      if (sameCategory) {
        activeEpisode = {
          ...activeEpisode,
          lastSeenAt: reading.timestamp,
          durationReadings:
            activeEpisode.durationReadings + 1,
          readings: [
            ...activeEpisode.readings,
            reading,
          ],
          value: strongestReason.value,
          reason: strongestReason.reason,
          severity: strongestReason.severity,
          reasons,
        };

        return;
      }

      /*
       * DIFFERENT SENSOR PATTERN
       *
       * Finish the previous episode only if it persisted.
       */

      if (
        activeEpisode.durationReadings >=
        PERSISTENCE_REQUIRED
      ) {
        episodes.push({
          ...activeEpisode,
          resolved: true,
          resolvedAt: reading.timestamp,
        });
      }

      activeEpisode = {
        id: `episode-${index}`,
        category: strongestReason.category,
        title: strongestReason.title,
        value: strongestReason.value,
        reason: strongestReason.reason,
        severity: strongestReason.severity,
        startedAt: reading.timestamp,
        lastSeenAt: reading.timestamp,
        durationReadings: 1,
        readings: [reading],
        reasons,
        resolved: false,
      };
    });

    /*
     * CURRENTLY ACTIVE EPISODE
     *
     * Do not show it until it has persisted enough.
     */

    if (
      activeEpisode &&
      activeEpisode.durationReadings >=
        PERSISTENCE_REQUIRED
    ) {
      episodes.push(activeEpisode);
    }

    return episodes
      .slice(-8)
      .reverse();
  }, [history]);

  /*
   * =========================================================
   * CURRENT MONITORING STATE
   * =========================================================
   */

  const currentState = useMemo(() => {
    if (!connected || !data) {
      return {
        label: "Waiting",
        title: "Waiting for monitoring data",
        description:
          "The monitoring device has not provided a current reading.",
        className: "state-waiting",
      };
    }

    const currentReasons = classifyReading(data);

    if (currentReasons.length === 0) {
      return {
        label: "Stable",
        title: "Stable monitoring",
        description:
          "Your recent sensor readings are following the current monitoring pattern.",
        className: "state-stable",
      };
    }

    const latestEpisode = monitoringEpisodes[0];

    /*
     * Persistent change
     */

    if (
      latestEpisode &&
      !latestEpisode.resolved &&
      latestEpisode.durationReadings >=
        PERSISTENCE_REQUIRED
    ) {
      return {
        label: "Needs attention",
        title: "A change has continued",
        description:
          "The system has noticed a persistent change and is continuing to monitor it.",
        className: "state-attention",
      };
    }

    /*
     * Temporary change
     */

    return {
      label: "Change noticed",
      title: "A change was noticed",
      description:
        "A temporary change has been noticed. The system is continuing to observe it.",
      className: "state-change",
    };
  }, [
    connected,
    data,
    monitoringEpisodes,
  ]);

  /*
   * =========================================================
   * RECENT EPISODES
   * =========================================================
   */

  const recentEpisodes =
    monitoringEpisodes.slice(0, 5);

  /*
   * =========================================================
   * PERSONAL SAFETY PLAN
   * =========================================================
   */

  const safetySteps = [
    {
      id: 1,
      title: "Move somewhere safe",
      description:
        "If you feel unwell or an alert requires action, move away from stairs, traffic, water, or other hazards.",
      icon: "⌂",
    },
    {
      id: 2,
      title: "Contact someone you trust",
      description:
        "Let a trusted person know that you may need assistance according to your personal safety plan.",
      icon: "●",
    },
    {
      id: 3,
      title: "Seek help when necessary",
      description:
        "For a serious or prolonged medical emergency, seek appropriate emergency medical assistance.",
      icon: "+",
    },
  ];

  const toggleSafetyStep = (stepId) => {
    setCompletedSteps((previous) => {
      if (previous.includes(stepId)) {
        return previous.filter(
          (id) => id !== stepId
        );
      }

      return [...previous, stepId];
    });
  };

  const readinessPercentage = Math.round(
    (completedSteps.length /
      safetySteps.length) *
      100
  );

  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */

  const formatTime = (date) => {
    if (!date) {
      return "--";
    }

    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (readings) => {
    if (!readings || readings <= 1) {
      return "brief change";
    }

    return `${readings} readings`;
  };

  /*
   * =========================================================
   * CURRENT SENSOR VALUES
   * =========================================================
   */

  const heartRate = Number(data?.heart_rate);
  const spo2 = Number(data?.spo2);

  /*
   * =========================================================
   * PAGE
   * =========================================================
   */

  return (
    <div className="risk-alerts-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <section className="risk-page-header">

        <div>
          <p className="page-label">
            SAFETY MONITOR
          </p>

          <h1>
            Risk & Alerts
          </h1>

          <p className="risk-page-description">
            Understand changes noticed during your
            monitoring session and know what to do if
            you need assistance.
          </p>
        </div>

        <div
          className={`risk-live-status ${
            connected
              ? "risk-live-connected"
              : "risk-live-disconnected"
          }`}
        >
          <span></span>

          {connected
            ? "Live monitoring"
            : "Device disconnected"}
        </div>

      </section>


      {/* =====================================================
          CURRENT MONITORING STATE
      ===================================================== */}

      <section
        className={`monitoring-state-card ${currentState.className}`}
      >

        <div className="monitoring-state-icon">
          {currentState.label === "Stable"
            ? "✓"
            : currentState.label === "Waiting"
            ? "•"
            : "!"}
        </div>

        <div className="monitoring-state-content">

          <span>
            CURRENT MONITORING STATE
          </span>

          <h2>
            {currentState.title}
          </h2>

          <p>
            {currentState.description}
          </p>

        </div>

        <div className="monitoring-state-time">

          <span>
            LAST READING
          </span>

          <strong>
            {formatTime(lastUpdated)}
          </strong>

        </div>

      </section>


      {/* =====================================================
          IMPORTANT CLARIFICATION
      ===================================================== */}

      <section className="monitoring-note">

        <div className="monitoring-note-icon">
          i
        </div>

        <div>

          <strong>
            What does a change mean?
          </strong>

          <p>
            A change in heart rate, oxygen, or movement
            does not by itself mean a seizure has occurred.
            This page simply helps identify sensor changes
            that may deserve attention.
          </p>

        </div>

      </section>


      {/* =====================================================
          MONITORING INSIGHTS
      ===================================================== */}

      <section className="monitoring-insights">

        <div className="section-heading-row">

          <div>

            <p className="section-label">
              MONITORING INSIGHTS
            </p>

            <h2>
              Recent changes
            </h2>

            <p>
              Only persistent or meaningful changes are
              shown here.
            </p>

          </div>

        </div>


        {/* ===================================================
            RECENT EPISODES
        =================================================== */}

        {recentEpisodes.length > 0 ? (

          <div className="monitoring-event-list">

            {recentEpisodes.map((episode) => {

              const isExpanded =
                expandedAlert === episode.id;

              return (

                <div
                  key={episode.id}
                  className={`monitoring-event ${
                    isExpanded
                      ? "monitoring-event-expanded"
                      : ""
                  }`}
                >

                  <button
                    className="monitoring-event-main"
                    onClick={() =>
                      setExpandedAlert(
                        isExpanded
                          ? null
                          : episode.id
                      )
                    }
                  >

                    <div
                      className={`event-status-icon event-${episode.severity}`}
                    >
                      {episode.resolved
                        ? "✓"
                        : "!"}
                    </div>

                    <div className="event-main-content">

                      <div className="event-title-row">

                        <strong>
                          {episode.title}
                        </strong>

                        {episode.resolved && (
                          <span className="resolved-badge">
                            RESOLVED
                          </span>
                        )}

                      </div>

                      <p>
                        {episode.value}
                        {" · "}
                        {formatDuration(
                          episode.durationReadings
                        )}
                      </p>

                    </div>

                    <time>
                      {formatTime(
                        episode.startedAt
                      )}
                    </time>

                    <span className="event-expand">
                      {isExpanded ? "−" : "+"}
                    </span>

                  </button>


                  {/* =================================================
                      EXPANDED DETAILS
                  ================================================= */}

                  {isExpanded && (

                    <div className="event-expanded-content">

                      <div className="event-reason">

                        <span>
                          WHY WAS THIS SHOWN?
                        </span>

                        <strong>
                          {episode.reason}
                        </strong>

                        <p>
                          This change continued across{" "}
                          {episode.durationReadings}{" "}
                          sensor readings, so it was grouped
                          into one monitoring episode instead
                          of creating repeated alerts.
                        </p>

                      </div>

                      <div className="event-detail-row">

                        <div>
                          <span>
                            SIGNAL
                          </span>

                          <strong>
                            {episode.category}
                          </strong>
                        </div>

                        <div>
                          <span>
                            READING
                          </span>

                          <strong>
                            {episode.value}
                          </strong>
                        </div>

                        <div>
                          <span>
                            STARTED
                          </span>

                          <strong>
                            {formatTime(
                              episode.startedAt
                            )}
                          </strong>
                        </div>

                        {episode.resolved && (

                          <div>
                            <span>
                              RESOLVED
                            </span>

                            <strong>
                              {formatTime(
                                episode.resolvedAt
                              )}
                            </strong>
                          </div>

                        )}

                      </div>

                    </div>

                  )}

                </div>

              );
            })}

          </div>

        ) : (

          <div className="stable-empty-state">

            <div className="stable-empty-icon">
              ✓
            </div>

            <div>

              <strong>
                Nothing concerning to review
              </strong>

              <p>
                No persistent sensor changes have been
                recorded during this monitoring session.
              </p>

            </div>

          </div>

        )}

      </section>


      {/* =====================================================
          HOW MONITORING WORKS
      ===================================================== */}

      <section className="how-monitoring-works">

        <div className="how-monitoring-icon">
          ✦
        </div>

        <div>

          <p className="section-label">
            SMART ALERTING
          </p>

          <h3>
            The system looks for patterns, not single readings
          </h3>

          <p>
            A temporary change is observed first. If a
            similar change continues across multiple readings,
            it becomes a monitoring episode. When the readings
            return toward their usual range, the episode can
            be marked as resolved.
          </p>

        </div>

      </section>


      {/* =====================================================
          PERSONAL SAFETY PLAN
      ===================================================== */}

      <section className="safety-action-center">

        <div className="safety-action-header">

          <div>

            <p className="section-label">
              PERSONAL SAFETY PLAN
            </p>

            <h2>
              If you receive an alert
            </h2>

            <p>
              Keep these simple actions in mind if the
              monitoring system asks you to pay attention
              or you feel that you need assistance.
            </p>

          </div>

          <div className="readiness-card">

            <div className="readiness-top">

              <span>
                SAFETY READINESS
              </span>

              <strong>
                {readinessPercentage}%
              </strong>

            </div>

            <div className="readiness-track">

              <div
                className="readiness-progress"
                style={{
                  width: `${readinessPercentage}%`,
                }}
              ></div>

            </div>

            <small>
              {completedSteps.length} of{" "}
              {safetySteps.length} actions reviewed
            </small>

          </div>

        </div>


        {/* ===================================================
            SAFETY STEPS
        =================================================== */}

        <div className="safety-steps">

          {safetySteps.map((step) => {

            const completed =
              completedSteps.includes(step.id);

            return (

              <button
                key={step.id}
                className={`safety-step ${
                  completed
                    ? "safety-step-completed"
                    : ""
                }`}
                onClick={() =>
                  toggleSafetyStep(step.id)
                }
              >

                <div className="safety-step-number">

                  {completed
                    ? "✓"
                    : `0${step.id}`}

                </div>

                <div className="safety-step-icon">
                  {step.icon}
                </div>

                <div className="safety-step-content">

                  <strong>
                    {step.title}
                  </strong>

                  <p>
                    {step.description}
                  </p>

                </div>

                <div className="safety-step-check">

                  {completed
                    ? "✓"
                    : "○"}

                </div>

              </button>

            );

          })}

        </div>


        {/* ===================================================
            SAFETY FOOTER
        =================================================== */}

        <div className="safety-action-footer">

          <div className="safety-status-message">

            <span>
              {readinessPercentage === 100
                ? "✓"
                : "i"}
            </span>

            <p>
              {readinessPercentage === 100
                ? "All safety actions have been reviewed."
                : "Review the actions above so you know what to do if an alert occurs."}
            </p>

          </div>

          <button
            className="reset-safety-button"
            onClick={() =>
              setCompletedSteps([])
            }
          >
            Reset checklist
          </button>

        </div>

      </section>


      {/* =====================================================
          CURRENT SENSOR SUMMARY
      ===================================================== */}

      <section className="risk-summary-grid">

        <article className="summary-card">

          <span className="summary-icon">
            ●
          </span>

          <div>

            <small>
              DEVICE
            </small>

            <strong>
              {connected
                ? "Connected"
                : "Disconnected"}
            </strong>

          </div>

        </article>


        <article className="summary-card">

          <span className="summary-icon">
            ♥
          </span>

          <div>

            <small>
              HEART RATE
            </small>

            <strong>
              {Number.isFinite(heartRate)
                ? `${heartRate.toFixed(0)} BPM`
                : "--"}
            </strong>

          </div>

        </article>


        <article className="summary-card">

          <span className="summary-icon">
            O₂
          </span>

          <div>

            <small>
              OXYGEN
            </small>

            <strong>
              {Number.isFinite(spo2)
                ? `${spo2.toFixed(0)}%`
                : "--"}
            </strong>

          </div>

        </article>


        <article className="summary-card">

          <span className="summary-icon">
            ◷
          </span>

          <div>

            <small>
              LAST READING
            </small>

            <strong>
              {formatTime(lastUpdated)}
            </strong>

          </div>

        </article>

      </section>

    </div>
  );
}

export default RiskAlerts;