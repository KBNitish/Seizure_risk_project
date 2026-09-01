from app.database.timescaledb import insert_health_reading


sensor_data = {
    "heart_rate": 78,
    "spo2": 97,
    "temperature": 36.8,
    "humidity": 54,
    "accel_x": 0.15,
    "accel_y": 0.08,
    "accel_z": 9.80,
    "gyro_x": 0.02,
    "gyro_y": 0.03,
    "gyro_z": 0.01,
    "ir_value": 12100,
    "red_value": 11600,
    "finger_detected": True
}


try:
    result = insert_health_reading(sensor_data)

    print("===================================")
    print("TimescaleDB INSERT SUCCESSFUL")
    print("===================================")
    print("Inserted ID:", result["id"])
    print("Created At:", result["created_at"])

except Exception as e:
    print("===================================")
    print("TimescaleDB INSERT FAILED")
    print("===================================")
    print("Error:", e)