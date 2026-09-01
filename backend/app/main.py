from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from app.models.sensor_data import SensorData
from app.database.timescaledb import get_db_connection


app = FastAPI(
    title="Smart Health Monitoring API",
    description="Real-time health monitoring and abnormal vital detection system",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# LIVE SENSOR CACHE
# ============================================================

# The newest ESP32 reading is kept here.
#
# Frontend reads this directly through:
# GET /sensor-data/latest
#
# This means the frontend does NOT have to wait for
# TimescaleDB.

latest_sensor_cache = None


# ============================================================
# DATABASE INSERT
# ============================================================

def save_sensor_data_to_db(sensor_data: dict):
    """
    Store one sensor reading in TimescaleDB.

    This function runs in the background so that the
    database operation does not block the live sensor flow.
    """

    connection = None
    cursor = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor()

        query = """
        INSERT INTO health_readings (
            heart_rate,
            spo2,
            temperature,
            humidity,
            accel_x,
            accel_y,
            accel_z,
            gyro_x,
            gyro_y,
            gyro_z,
            ir_value,
            red_value,
            finger_detected
        )
        VALUES (
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s
        );
        """

        values = (
            sensor_data["heart_rate"],
            sensor_data["spo2"],
            sensor_data["temperature"],
            sensor_data["humidity"],
            sensor_data["accel_x"],
            sensor_data["accel_y"],
            sensor_data["accel_z"],
            sensor_data["gyro_x"],
            sensor_data["gyro_y"],
            sensor_data["gyro_z"],
            sensor_data["ir_value"],
            sensor_data["red_value"],
            sensor_data["finger_detected"]
        )

        cursor.execute(query, values)

        connection.commit()

        print("-> TimescaleDB: INSERT OK")

    except Exception as e:

        if connection is not None:
            connection.rollback()

        print("-> TimescaleDB INSERT ERROR:", e)

    finally:

        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "Smart Health Monitoring API is running"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health_check():

    return {
        "status": "healthy"
    }


# ============================================================
# RECEIVE SENSOR DATA
#
# ESP32
#   ↓
# serial_bridge.py
#   ↓
# FastAPI
#   ├──→ LIVE CACHE immediately
#   │
#   └──→ TimescaleDB in background
# ============================================================

@app.post("/sensor-data")
def receive_sensor_data(
    data: SensorData,
    background_tasks: BackgroundTasks
):

    global latest_sensor_cache

    # --------------------------------------------------------
    # STEP 1
    #
    # Immediately update the live sensor value.
    # --------------------------------------------------------

    latest_sensor_cache = data.model_dump()

    # --------------------------------------------------------
    # STEP 2
    #
    # Save to TimescaleDB in the background.
    #
    # FastAPI does NOT wait for the remote database here.
    # --------------------------------------------------------

    background_tasks.add_task(
        save_sensor_data_to_db,
        latest_sensor_cache.copy()
    )

    # --------------------------------------------------------
    # STEP 3
    #
    # Return immediately to serial_bridge.
    # --------------------------------------------------------

    return {
        "message": "Sensor data received",
        "data": latest_sensor_cache
    }


# ============================================================
# GET LATEST SENSOR DATA
#
# Frontend
#   ↓
# FastAPI LIVE CACHE
#   ↓
# immediate response
# ============================================================

@app.get("/sensor-data/latest")
def get_latest_sensor_data():

    # --------------------------------------------------------
    # If ESP32 data has already arrived, return it immediately.
    # --------------------------------------------------------

    if latest_sensor_cache is not None:

        return {
            "message": "Latest live sensor data",
            "data": latest_sensor_cache
        }

    # --------------------------------------------------------
    # If FastAPI has just started and no ESP32 reading has
    # arrived yet, return an empty result.
    #
    # We intentionally do NOT query TimescaleDB here because
    # this endpoint is for LIVE sensor monitoring.
    # --------------------------------------------------------

    return {
        "message": "Waiting for live sensor data",
        "data": None
    }