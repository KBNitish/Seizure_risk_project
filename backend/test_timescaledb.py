from app.database.timescaledb import get_db_connection


try:
    connection = get_db_connection()

    print("===================================")
    print("TimescaleDB connection SUCCESSFUL")
    print("===================================")

    cursor = connection.cursor()

    cursor.execute("SELECT version();")

    result = cursor.fetchone()

    print("Database version:")
    print(result[0])

    cursor.close()
    connection.close()

    print("Connection closed successfully.")

except Exception as e:
    print("===================================")
    print("TimescaleDB connection FAILED")
    print("===================================")
    print("Error:", e)