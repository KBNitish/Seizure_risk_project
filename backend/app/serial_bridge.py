import serial
import requests
import json
import time
import threading
from queue import Queue, Empty


SERIAL_PORT = "COM17"
BAUD_RATE = 115200

API_URL = "http://127.0.0.1:8000/sensor-data"


# Queue between ESP32 reader and FastAPI sender
data_queue = Queue(maxsize=50)


# ============================================================
# FASTAPI SENDER
# Runs separately so serial reading never gets blocked
# ============================================================

def api_sender():

    session = requests.Session()

    while True:

        try:

            data = data_queue.get()

            try:

                response = session.post(
                    API_URL,
                    json=data,
                    timeout=(0.5, 3)
                )

                if response.status_code == 200:

                    print("  -> FastAPI: OK")

                else:

                    print(
                        f"  -> FastAPI ERROR: "
                        f"{response.status_code}"
                    )

            except requests.RequestException as e:

                print(
                    "  -> FASTAPI ERROR:",
                    e
                )

            finally:

                data_queue.task_done()

        except Exception as e:

            print(
                "API SENDER ERROR:",
                e
            )


# ============================================================
# MAIN
# ============================================================

def main():

    print("========================================")
    print("       ESP32 SERIAL BRIDGE")
    print("========================================")

    print(f"Connecting to {SERIAL_PORT}...")

    try:

        ser = serial.Serial(
            port=SERIAL_PORT,
            baudrate=BAUD_RATE,
            timeout=0.1
        )

        time.sleep(2)

        # Remove old/stale serial data
        ser.reset_input_buffer()

        print("ESP32 CONNECTED")
        print("Waiting for live sensor data...")
        print()

    except serial.SerialException as e:

        print("ERROR: Could not connect to ESP32")
        print(e)

        return


    # ========================================================
    # START FASTAPI SENDER THREAD
    # ========================================================

    sender_thread = threading.Thread(
        target=api_sender,
        daemon=True
    )

    sender_thread.start()


    # ========================================================
    # READ ESP32 CONTINUOUSLY
    # ========================================================

    try:

        while True:

            line = ser.readline().decode(
                "utf-8",
                errors="ignore"
            ).strip()


            if not line:
                continue


            # Ignore normal Arduino messages
            if not line.startswith("JSON:"):
                continue


            # Remove JSON: prefix

            json_string = line[5:].strip()


            # =================================================
            # PARSE JSON
            # =================================================

            try:

                data = json.loads(json_string)

            except json.JSONDecodeError as e:

                print(
                    "JSON ERROR:",
                    e
                )

                continue


            # =================================================
            # DISPLAY IMMEDIATELY
            # =================================================

            finger = data.get("finger_detected")

            heart_rate = data.get("heart_rate")

            spo2 = data.get("spo2")

            temperature = data.get("temperature")


            print(
                f"ESP32 -> "
                f"Finger: "
                f"{'DETECTED' if finger is True else 'NOT DETECTED'}"
                f" | HR: {heart_rate}"
                f" BPM"
                f" | SpO2: {spo2}"
                f" | Temp: {temperature} C"
            )


            # =================================================
            # PUT DATA INTO QUEUE
            # DO NOT WAIT FOR FASTAPI
            # =================================================

            try:

                data_queue.put_nowait(data)

            except:

                # If API is slower than ESP32,
                # discard the oldest queued reading
                # so live data does not become stale.

                try:

                    data_queue.get_nowait()
                    data_queue.task_done()

                except Empty:

                    pass

                try:

                    data_queue.put_nowait(data)

                except:

                    pass


    except KeyboardInterrupt:

        print()
        print("Stopping ESP32 serial bridge...")


    finally:

        ser.close()

        print(
            "ESP32 serial connection closed."
        )


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    main()