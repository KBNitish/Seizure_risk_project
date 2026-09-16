import json
import os
import pickle
from datetime import datetime

import numpy as np
from kafka import KafkaConsumer, KafkaProducer


# ============================================================
# CONFIGURATION
# ============================================================

KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"

INPUT_TOPIC = "health_readings_features"
OUTPUT_TOPIC = "seizure_predictions_live"

CONSUMER_GROUP = "seizure-model-consumer-v2"

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "models",
    "seizure_model.pkl",
)


# ============================================================
# LOAD MODEL
# ============================================================

print("Loading model...")

with open(MODEL_PATH, "rb") as f:
    model_bundle = pickle.load(f)

model = model_bundle["model"]

FEATURE_COLS = model_bundle["feature_cols"]

print("Model loaded successfully.")
print("Model:", model_bundle.get("model_name", "Unknown"))
print("Features:", len(FEATURE_COLS))
print("Feature columns:", FEATURE_COLS)
print("Window:", model_bundle.get("window", "Unknown"))


# ============================================================
# FEATURE VALIDATION
# ============================================================

if len(FEATURE_COLS) != model.n_features_in_:
    raise ValueError(
        f"Feature mismatch: PKL contains {len(FEATURE_COLS)} "
        f"features but model expects {model.n_features_in_}"
    )

print(
    f"Feature validation passed: "
    f"{len(FEATURE_COLS)} features"
)


# ============================================================
# KAFKA CONSUMER
# ============================================================

consumer = KafkaConsumer(
    INPUT_TOPIC,
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    group_id=CONSUMER_GROUP,
    auto_offset_reset="latest",
    enable_auto_commit=True,
    value_deserializer=lambda x: json.loads(
        x.decode("utf-8")
    ),
)


# ============================================================
# KAFKA PRODUCER
# ============================================================

producer = KafkaProducer(
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    value_serializer=lambda x: json.dumps(
        x,
        separators=(",", ":")
    ).encode("utf-8")
)


# ============================================================
# KAFKA CONNECT SCHEMA
# ============================================================

OUTPUT_SCHEMA = {
    "type": "struct",
    "name": "seizure_prediction",
    "optional": False,
    "fields": [
        {
            "type": "int64",
            "optional": False,
            "field": "health_reading_id"
        },
        {
            "type": "int64",
            "name": "org.apache.kafka.connect.data.Timestamp",
            "version": 1,
            "optional": False,
            "field": "created_at"
        },
        {
            "type": "double",
            "optional": True,
            "field": "risk_score"
        },
        {
            "type": "string",
            "optional": True,
            "field": "risk_level"
        },
        {
            "type": "string",
            "optional": True,
            "field": "prediction"
        },
        {
            "type": "string",
            "optional": True,
            "field": "model_version"
        }
    ]
}


# ============================================================
# TIMESTAMP HELPER
# ============================================================

def convert_created_at_to_epoch_ms(created_at):

    if created_at is None:
        return None

    if isinstance(created_at, str):

        created_at = created_at.replace(
            "Z",
            "+00:00"
        )

        dt = datetime.fromisoformat(
            created_at
        )

        return int(
            dt.timestamp() * 1000
        )

    return int(created_at)


# ============================================================
# START MESSAGE
# ============================================================

print()
print("==============================================")
print("        SEIZURE MODEL CONSUMER 2")
print("==============================================")
print("Input :", INPUT_TOPIC)
print("Output:", OUTPUT_TOPIC)
print("Group :", CONSUMER_GROUP)
print("Model :", model_bundle.get("model_name", "Unknown"))
print("Features:", len(FEATURE_COLS))
print("Status: Waiting for Kafka messages...")
print("Press Ctrl+C to stop.")
print("==============================================")
print()

counter = 0


# ============================================================
# PROCESS MESSAGES
# ============================================================

try:

    for message in consumer:

        try:

            data = message.value

            # ------------------------------------------------
            # Build feature vector
            # ------------------------------------------------

            feature_values = []

            for feature in FEATURE_COLS:

                value = data.get(
                    feature,
                    0.0
                )

                if value is None:
                    value = 0.0

                feature_values.append(
                    float(value)
                )

            X = np.array(
                [feature_values],
                dtype=float
            )

            # ------------------------------------------------
            # Final safety check
            # ------------------------------------------------

            if X.shape[1] != model.n_features_in_:

                raise ValueError(
                    f"Input contains {X.shape[1]} features "
                    f"but model expects "
                    f"{model.n_features_in_}"
                )

            # ------------------------------------------------
            # Prediction
            # ------------------------------------------------

            prediction = int(
                model.predict(X)[0]
            )

            # ------------------------------------------------
            # Seizure probability
            # ------------------------------------------------

            if hasattr(
                model,
                "predict_proba"
            ):

                probabilities = model.predict_proba(X)[0]

                classes = list(
                    model.classes_
                )

                if 1 in classes:

                    seizure_probability = float(
                        probabilities[
                            classes.index(1)
                        ]
                    )

                else:

                    seizure_probability = 0.0

            else:

                seizure_probability = float(
                    prediction
                )

            # ------------------------------------------------
            # Risk mapping
            # ------------------------------------------------

            if prediction == 1:

                risk_level = "HIGH"
                prediction_text = "Seizure"

            else:

                risk_level = "LOW"
                prediction_text = "No Seizure"

            # ------------------------------------------------
            # IDs / timestamp
            # ------------------------------------------------

            health_reading_id = int(
                data["health_reading_id"]
            )

            created_at = data.get(
                "created_at"
            )

            created_at_epoch_ms = (
                convert_created_at_to_epoch_ms(
                    created_at
                )
            )

            # ------------------------------------------------
            # Kafka payload
            # ------------------------------------------------

            payload = {
                "health_reading_id":
                    health_reading_id,

                "created_at":
                    created_at_epoch_ms,

                "risk_score":
                    seizure_probability,

                "risk_level":
                    risk_level,

                "prediction":
                    prediction_text,

                "model_version":
                    "gradient_boosting_v1"
            }

            # ------------------------------------------------
            # Final Kafka Connect message
            # ------------------------------------------------

            output_message = {
                "schema":
                    OUTPUT_SCHEMA,

                "payload":
                    payload
            }

            # ------------------------------------------------
            # Send prediction
            # ------------------------------------------------

            producer.send(
                OUTPUT_TOPIC,
                value=output_message
            )

            producer.flush()

            counter += 1

            print(
                f"[{counter}] "
                f"ID={health_reading_id} | "
                f"Risk Score="
                f"{seizure_probability:.4f} | "
                f"Risk={risk_level} | "
                f"Prediction="
                f"{prediction_text}"
            )

        except Exception as e:

            print(
                f"[ERROR] Processing message: "
                f"{repr(e)}"
            )


# ============================================================
# CLEAN SHUTDOWN
# ============================================================

except KeyboardInterrupt:

    print()
    print("[INFO] Ctrl+C received.")
    print("[INFO] Stopping Consumer 2...")


finally:

    print(
        "[INFO] Closing Kafka producer..."
    )

    try:

        producer.flush()
        producer.close()

    except Exception:
        pass

    print(
        "[INFO] Closing Kafka consumer..."
    )

    try:

        consumer.close()

    except Exception:
        pass

    print(
        "[INFO] Consumer 2 stopped cleanly."
    )

    print(
        f"[INFO] Total predictions processed: "
        f"{counter}"
    )