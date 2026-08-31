from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.sensor_data import SensorData
from app.database.supabase import supabase


app = FastAPI(
    title="Smart Health Monitoring API",
    description="Real-time health monitoring and abnormal vital detection system",
    version="1.0.0"
)


# ============================================================
# CORS CONFIGURATION
# Allows the React frontend running on localhost:5173
# to communicate with this FastAPI backend.
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
# ESP32 / testing client -> FastAPI -> Supabase
# ============================================================

@app.post("/sensor-data")
def receive_sensor_data(data: SensorData):

    sensor_data = {
        "heart_rate": data.heart_rate,
        "spo2": data.spo2,
        "temperature": data.temperature,
        "humidity": data.humidity,
        "accel_x": data.accel_x,
        "accel_y": data.accel_y,
        "accel_z": data.accel_z,
        "gyro_x": data.gyro_x,
        "gyro_y": data.gyro_y,
        "gyro_z": data.gyro_z,
        "ir_value": data.ir_value,
        "red_value": data.red_value,
        "finger_detected": data.finger_detected
    }

    result = (
        supabase
        .table("health_readings")
        .insert(sensor_data)
        .execute()
    )

    return {
        "message": "Sensor data stored successfully",
        "data": data,
        "database": result.data
    }


# ============================================================
# GET LATEST SENSOR DATA
# Supabase -> FastAPI -> React frontend
# ============================================================

@app.get("/sensor-data/latest")
def latest_sensor_data():

    result = (
        supabase
        .table("health_readings")
        .select("*")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        return {
            "message": "No sensor data available",
            "data": None
        }

    return {
        "message": "Latest sensor data",
        "data": result.data[0]
    }