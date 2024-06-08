from flask import Flask
import subprocess
import os
import time

app = Flask(__name__)

# Define the path to the NordVPN executable
NORDVPN_PATH = r"C:\Program Files\NordVPN"

# Global variable to keep track of the last execution time
last_execution_time = 0

def change_vpn_server():
    global last_execution_time
    current_time = time.time()

    # Check if the last execution was within the last minute
    if current_time - last_execution_time < 120:
        print("VPN change attempted within the last minute, skipping.")
        return 'VPN change attempted within the last minute, skipping.', 200

    original_cwd = os.getcwd()
    os.chdir(NORDVPN_PATH)

    try:
        print(f"Changed working directory to {os.getcwd()}")

        result = subprocess.run(['nordvpn', '--connect'], check=True, capture_output=True, text=True)
        print(f"Connect result: {result.stdout} {result.stderr}")

        last_execution_time = current_time

    except subprocess.CalledProcessError as e:
        print(f"Command failed with exit status {e.returncode}: {e.output}")
        raise e

    finally:
        os.chdir(original_cwd)
        print(f"Reverted working directory to {os.getcwd()}")

@app.route('/', methods=['GET'])
def handle_request():
    try:
        response, status = change_vpn_server()
        return response, status
    except subprocess.CalledProcessError as e:
        return f'Failed to change VPN connection: {e}', 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4321)