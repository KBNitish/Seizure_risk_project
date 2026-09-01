import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

TIMESCALEDB_URL = os.getenv("TIMESCALEDB_URL")

if not TIMESCALEDB_URL:
    raise RuntimeError("TIMESCALEDB_URL is missing from .env")


def get_db_connection():
    """
    Create and return a connection to TimescaleDB.
    """
    connection = psycopg2.connect(TIMESCALEDB_URL)
    return connection


def insert_health_reading(sensor_data):
    """
    Insert one sensor reading into the health_readings table.
    """

    connection = get_db_connection()

    try:
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
            )
            RETURNING id, created_at;
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

        result = cursor.fetchone()

        connection.commit()

        return {
            "id": result[0],
            "created_at": result[1]
        }

    finally:
        cursor.close()
        connection.close()