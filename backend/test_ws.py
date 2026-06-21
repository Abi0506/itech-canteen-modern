import asyncio
import websockets

async def test_ws():
    uri = "ws://127.0.0.1:8000/ws/kds"
    try:
        print(f"Connecting to {uri}...")
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            return True
    except websockets.ConnectionClosed as e:
        print(f"Connection closed: {e.code} {e.reason}")
    except Exception as e:
        print(f"Error: {e}")
    return False

import asyncio
asyncio.run(test_ws())

