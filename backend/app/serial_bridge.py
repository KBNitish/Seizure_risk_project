import serial
import requests
import json
import time

SERIAL_PORT = "COM17"
BAUD_RATE = 115200

API_URL = "http://127.0.0.1:8000/sensor-data"


def main():

    print("========================================")
    print("       ESP32 SERIAL BRIDGE")
    print("========================================")

    print(f"Connecting to {SERIAL_PORT}...")

    try:
        ser = serial.Serial(
            SERIAL_PORT,
            BAUD_RATE,
            timeout=1
        )

        time.sleep(2)

        print("ESP32 CONNECTED")
        print("Waiting for sensor data...")
        print()

    except serial.SerialException as e:

        print("ERROR: Could not connect to ESP32")
        print(e)

        return


    while True:

        try:

            line = ser.readline().decode(
                "utf-8",
                errors="ignore"
            ).strip()

            if not line:
                continue


            print("ESP32:", line)


            # =================================================
            # ESP32 sends:
            #
            # JSON:{...}
            #
            # We only process lines beginning with JSON:
            # =================================================

            if not line.startswith("JSON:"):

                continue


            # Remove "JSON:" prefix

            json_string = line[5:].strip()


            # =================================================
            # Convert JSON string into Python dictionary
            # =================================================

            try:

                data = json.loads(json_string)

            except json.JSONDecodeError as e:

                print("JSON ERROR:", e)

                continue


            print()
            print("========== SENSOR DATA ==========")

            print(
                json.dumps(
                    data,
                    indent=2
                )
            )

            print("=================================")


            # =================================================
            # Send data to FastAPI
            # =================================================

            try:

                response = requests.post(
                    API_URL,
                    json=data,
                    timeout=5
                )


                print(
                    "FastAPI Status:",
                    response.status_code
                )


                try:

                    print(
                        "FastAPI Response:",
                        response.json()
                    )

                except:

                    print(
                        "FastAPI Response:",
                        response.text
                    )


            except requests.RequestException as e:

                print(
                    "FASTAPI CONNECTION ERROR:",
                    e
                )


            print()


        except KeyboardInterrupt:

            print()
            print("Stopping ESP32 serial bridge...")

            break


        except Exception as e:

            print(
                "SERIAL ERROR:",
                e
            )


    ser.close()


if __name__ == "__main__":

    main()