from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from app.models.sensor_data import SensorData
from app.database.timescaledb import get_db_connection


app = FastAPI(
    title="Smart Health Monitoring API",
    description="Real-time health monitoring and seizure-risk assessment system",
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

latest_sensor_cache = None


# ============================================================
# DATABASE INSERT
# ============================================================

def save_sensor_data_to_db(sensor_data: dict):
    """
    Store one sensor reading in TimescaleDB.
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
# ============================================================

@app.post("/sensor-data")
def receive_sensor_data(
    data: SensorData,
    background_tasks: BackgroundTasks
):

    global latest_sensor_cache

    # Update live cache immediately
    latest_sensor_cache = data.model_dump()

    # Save to database without blocking live flow
    background_tasks.add_task(
        save_sensor_data_to_db,
        latest_sensor_cache.copy()
    )

    return {
        "message": "Sensor data received",
        "data": latest_sensor_cache
    }


# ============================================================
# GET LATEST SENSOR DATA
# ============================================================

@app.get("/sensor-data/latest")
def get_latest_sensor_data():

    if latest_sensor_cache is not None:

        return {
            "message": "Latest live sensor data",
            "data": latest_sensor_cache
        }

    return {
        "message": "Waiting for live sensor data",
        "data": None
    }


# ============================================================
# SEIZURE RISK - LATEST
# ============================================================

@app.get("/seizure-risk/latest")
def get_latest_seizure_risk():

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
        SELECT
            created_at,
            risk_score,
            risk_level,
            prediction,
            model_version
        FROM seizure_predictions
        ORDER BY created_at DESC
        LIMIT 1;
        """

        cursor.execute(query)

        row = cursor.fetchone()

        if row is None:

            return {
                "message": "No seizure-risk assessment available",
                "data": None
            }

        return {
            "message": "Latest seizure-risk assessment",
            "data": {
                "created_at": row[0],
                "risk_score": float(row[1]),
                "risk_level": row[2],
                "prediction": row[3],
                "model_version": row[4]
            }
        }

    except Exception as e:

        print("-> SEIZURE RISK ERROR:", e)

        return {
            "message": "Unable to retrieve seizure-risk assessment",
            "data": None,
            "error": str(e)
        }

    finally:

        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


# ============================================================
# SEIZURE RISK - HISTORY
# ============================================================

@app.get("/seizure-risk/history")
def get_seizure_risk_history(limit: int = 30):

    connection = None
    cursor = None

    try:

        # Keep limit within a safe range
        limit = max(1, min(limit, 100))

        connection = get_db_connection()
        cursor = connection.cursor()

        query = f"""
        SELECT
            created_at,
            risk_score,
            risk_level,
            prediction,
            model_version
        FROM seizure_predictions
        ORDER BY created_at DESC
        LIMIT {limit};
        """

        cursor.execute(query)

        rows = cursor.fetchall()

        history = []

        for row in rows:

            history.append({
                "created_at": row[0],
                "risk_score": float(row[1]),
                "risk_level": row[2],
                "prediction": row[3],
                "model_version": row[4]
            })

        return {
            "message": "Seizure-risk history",
            "data": history
        }

    except Exception as e:

        print("-> SEIZURE RISK HISTORY ERROR:", e)

        return {
            "message": "Unable to retrieve seizure-risk history",
            "data": [],
            "error": str(e)
        }

    finally:

        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


# ============================================================
# MODEL INFORMATION
# ============================================================

@app.get("/seizure-risk/model-info")
def get_seizure_model_info():

    return {
        "model_name": "Gradient Boosting",

        # Documented evaluation result
        "accuracy": 1.0,

        "accuracy_percentage": 100,

        "evaluation_method":
            "3-fold leave-one-episode-out cross-validation",

        "evaluation_summary":
            "The model achieved 100% mean accuracy across the three evaluation folds.",

        "explanation":
            "Accuracy measures the proportion of evaluated samples that were classified correctly. "
            "The reported value comes from the model evaluation performed on held-out seizure episodes.",

        "important_note":
            "This is a model evaluation result from the project dataset. "
            "It does not mean the system is clinically validated or that every future seizure will be detected.",

        "window": 5,

        "model_version": "gradient_boosting_v1"
    }