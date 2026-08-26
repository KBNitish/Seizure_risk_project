from pydantic import BaseModel
from typing import Optional


class SensorData(BaseModel):
    heart_rate: float = 0.0
    spo2: Optional[float] = None

    temperature: float = 0.0
    humidity: float = 0.0

    accel_x: float = 0.0
    accel_y: float = 0.0
    accel_z: float = 0.0

    gyro_x: float = 0.0
    gyro_y: float = 0.0
    gyro_z: float = 0.0

    ir_value: int = 0
    red_value: int = 0
    finger_detected: bool = False