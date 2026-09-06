import json
import math
from collections import deque

import pandas as pd
from kafka import KafkaConsumer, KafkaProducer


# ============================================================
# KAFKA CONFIGURATION
# ============================================================

KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"

INPUT_TOPIC = "postgres.public.health_readings"

OUTPUT_TOPIC = "health_readings_features"

CONSUMER_GROUP = "health-readings-preprocessor"

# Training used a 5-second window at 1 Hz
WINDOW = 5


# ============================================================
# MODEL FEATURES
# ============================================================

# These are the 6 base features used during model training.
BASE_FEATURES = [
    "heart_rate",
    "spo2",
    "accel_mag",
    "gyro_mag",
    "ir_value",
    "red_value",
]


# Exactly the 30 features used by the trained model.
FEATURE_COLS = [
    # Current/base features
    "heart_rate",
    "spo2",
    "accel_mag",
    "gyro_mag",
    "ir_value",
    "red_value",

    # Heart rate
    "heart_rate_roll_mean",
    "heart_rate_roll_std",
    "heart_rate_roll_max",
    "heart_rate_rate",

    # SpO2
    "spo2_roll_mean",
    "spo2_roll_std",
    "spo2_roll_max",
    "spo2_rate",

    # Acceleration magnitude
    "accel_mag_roll_mean",
    "accel_mag_roll_std",
    "accel_mag_roll_max",
    "accel_mag_rate",

    # Gyroscope magnitude
    "gyro_mag_roll_mean",
    "gyro_mag_roll_std",
    "gyro_mag_roll_max",
    "gyro_mag_rate",

    # IR
    "ir_value_roll_mean",
    "ir_value_roll_std",
    "ir_value_roll_max",
    "ir_value_rate",

    # RED
    "red_value_roll_mean",
    "red_value_roll_std",
    "red_value_roll_max",
    "red_value_rate",
]


# ============================================================
# ROLLING WINDOW
# ============================================================

# Keeps the latest 5 readings.
history = deque(maxlen=WINDOW)


# ============================================================
# KAFKA PRODUCER
# ============================================================

producer = KafkaProducer(
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    value_serializer=lambda value: json.dumps(value).encode("utf-8"),
)


# ============================================================
# KAFKA CONSUMER
# ============================================================

consumer = KafkaConsumer(
    INPUT_TOPIC,
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    group_id=CONSUMER_GROUP,
    auto_offset_reset="earliest",
    enable_auto_commit=True,
    value_deserializer=lambda value: json.loads(value.decode("utf-8")),
)


# ============================================================
# SAFE FLOAT CONVERSION
# ============================================================

def safe_float(value):
    """
    Convert a value safely to float.

    If the value is missing, invalid, NaN, or infinity,
    return 0.0.
    """

    if value is None:
        return 0.0

    try:
        value = float(value)

        if math.isnan(value) or math.isinf(value):
            return 0.0

        return value

    except (TypeError, ValueError):
        return 0.0


# ============================================================
# EXTRACT DATA FROM DEBEZIUM MESSAGE
# ============================================================

def extract_sensor_data(message):
    """
    Debezium message structure:

    {
        "payload": {
            "before": ...,
            "after": {
                ...
            },
            "op": "c"
        }
    }

    We only need payload.after.
    """

    if not isinstance(message, dict):
        return None

    payload = message.get("payload")

    if not isinstance(payload, dict):
        return None

    after = payload.get("after")

    if not isinstance(after, dict):
        return None

    return after


# ============================================================
# CREATE BASE FEATURES
# ============================================================

def create_base_features(sensor_data):
    """
    Convert raw sensor values into the 6 base features
    used during model training.

    accel_mag = sqrt(accel_x² + accel_y² + accel_z²)

    gyro_mag = sqrt(gyro_x² + gyro_y² + gyro_z²)
    """

    # --------------------------------------------------------
    # Accelerometer
    # --------------------------------------------------------

    accel_x = safe_float(sensor_data.get("accel_x"))
    accel_y = safe_float(sensor_data.get("accel_y"))
    accel_z = safe_float(sensor_data.get("accel_z"))

    accel_mag = math.sqrt(
        accel_x ** 2
        + accel_y ** 2
        + accel_z ** 2
    )

    # --------------------------------------------------------
    # Gyroscope
    # --------------------------------------------------------

    gyro_x = safe_float(sensor_data.get("gyro_x"))
    gyro_y = safe_float(sensor_data.get("gyro_y"))
    gyro_z = safe_float(sensor_data.get("gyro_z"))

    gyro_mag = math.sqrt(
        gyro_x ** 2
        + gyro_y ** 2
        + gyro_z ** 2
    )

    # --------------------------------------------------------
    # Return the 6 base features
    # --------------------------------------------------------

    return {
        "heart_rate": safe_float(
            sensor_data.get("heart_rate")
        ),

        "spo2": safe_float(
            sensor_data.get("spo2")
        ),

        "accel_mag": accel_mag,

        "gyro_mag": gyro_mag,

        "ir_value": safe_float(
            sensor_data.get("ir_value")
        ),

        "red_value": safe_float(
            sensor_data.get("red_value")
        ),
    }


# ============================================================
# CREATE ALL 30 MODEL FEATURES
# ============================================================

def create_model_features(sensor_data):
    """
    Create the exact 30 features used by the trained model.

    Steps:

    1. Create the 6 base features.
    2. Add them to the 5-reading history.
    3. Calculate rolling mean.
    4. Calculate rolling standard deviation.
    5. Calculate rolling maximum.
    6. Calculate rate of change.
    """

    # --------------------------------------------------------
    # Step 1: Create current/base features
    # --------------------------------------------------------

    base_features = create_base_features(sensor_data)

    # --------------------------------------------------------
    # Step 2: Add current reading to history
    # --------------------------------------------------------

    history.append(base_features)

    # Convert history into a DataFrame so that the
    # calculations match the training notebook.
    df = pd.DataFrame(list(history))

    output = {}

    # --------------------------------------------------------
    # Step 3: Current values
    # --------------------------------------------------------

    for feature in BASE_FEATURES:

        output[feature] = float(
            df[feature].iloc[-1]
        )

    # --------------------------------------------------------
    # Step 4: Rolling features
    # --------------------------------------------------------

    for feature in BASE_FEATURES:

        rolling = df[feature].rolling(
            WINDOW,
            min_periods=1
        )

        # Rolling mean
        output[
            f"{feature}_roll_mean"
        ] = float(
            rolling.mean().iloc[-1]
        )

        # Rolling standard deviation
        output[
            f"{feature}_roll_std"
        ] = float(
            rolling.std()
            .fillna(0)
            .iloc[-1]
        )

        # Rolling maximum
        output[
            f"{feature}_roll_max"
        ] = float(
            rolling.max().iloc[-1]
        )

        # Rate of change
        difference = (
            df[feature]
            .diff()
            .fillna(0)
        )

        output[
            f"{feature}_rate"
        ] = float(
            difference.iloc[-1]
        )

    return output


# ============================================================
# STARTUP MESSAGE
# ============================================================

print("==============================================")
print("        CONSUMER 1 - PREPROCESSOR")
print("==============================================")
print(f"Input topic : {INPUT_TOPIC}")
print(f"Output topic: {OUTPUT_TOPIC}")
print(f"Window      : {WINDOW} samples")
print(f"Features    : {len(FEATURE_COLS)}")
print("==============================================")
print("Waiting for Kafka messages...")
print()


# ============================================================
# MAIN CONSUMER LOOP
# ============================================================

message_count = 0

try:

    for message in consumer:

        try:

            # ------------------------------------------------
            # 1. Get Debezium message
            # ------------------------------------------------

            debezium_message = message.value

            # ------------------------------------------------
            # 2. Extract payload.after
            # ------------------------------------------------

            sensor_data = extract_sensor_data(
                debezium_message
            )

            if sensor_data is None:
                continue

            # ------------------------------------------------
            # 3. Create the 30 model features
            # ------------------------------------------------

            features = create_model_features(
                sensor_data
            )

            # ------------------------------------------------
            # 4. Build output message
            # ------------------------------------------------

            processed_data = {
                "health_reading_id": sensor_data.get("id"),
                "created_at": sensor_data.get("created_at"),
            }

            # Add all 30 features in the exact order
            # expected by the trained model.
            for feature in FEATURE_COLS:

                processed_data[feature] = (
                    features[feature]
                )

            # ------------------------------------------------
            # 5. Send processed data to Kafka
            # ------------------------------------------------

            producer.send(
                OUTPUT_TOPIC,
                value=processed_data
            )

            producer.flush()

            # ------------------------------------------------
            # 6. Display progress
            # ------------------------------------------------

            message_count += 1

            print(
                f"[{message_count}] "
                f"ID={processed_data['health_reading_id']} "
                f"| HR={processed_data['heart_rate']:.1f} "
                f"| SpO2={processed_data['spo2']:.1f} "
                f"| AccelMag={processed_data['accel_mag']:.3f} "
                f"| GyroMag={processed_data['gyro_mag']:.3f} "
                f"| IR={processed_data['ir_value']:.0f} "
                f"| RED={processed_data['red_value']:.0f}"
            )

        except Exception as e:

            print(
                "PROCESSING ERROR:",
                e
            )

            continue


except KeyboardInterrupt:

    print()
    print("Stopping Consumer 1...")


finally:

    producer.close()
    consumer.close()

    print("Consumer 1 stopped.")