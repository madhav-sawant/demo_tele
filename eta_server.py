from flask import Flask, request, jsonify
from flask_cors import CORS
import math
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Function to convert degrees to radians
def to_rad(degrees):
    return degrees * math.pi / 180

# Haversine formula to calculate distance between two coordinates with high precision
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth's radius in meters
    d_lat = to_rad(lat2 - lat1)
    d_lon = to_rad(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) * math.sin(d_lat / 2) +
        math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * 
        math.sin(d_lon / 2) * math.sin(d_lon / 2)
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c  # Distance in meters
    return distance

@app.route('/calculate_eta', methods=['POST'])
def calculate_eta():
    data = request.json
    
    if not data or 'waypoints' not in data or 'speed' not in data:
        return jsonify({'error': 'Missing required data'}), 400
    
    waypoints = data['waypoints']
    speed = data['speed']  # speed in m/s
    return_to_home = data.get('returnToHome', True)
    
    # Log request for debugging
    print(f"Received request with {len(waypoints)} waypoints, speed: {speed}")
    
    # Simulate complex calculations (adding a small delay for demonstration)
    time.sleep(0.5)
    
    # Calculate segments
    segments = []
    total_distance = 0
    total_time_seconds = 0
    
    if not waypoints or len(waypoints) < 1:
        return jsonify({
            'eta': '00:00:00',
            'segments': [],
            'totalDistance': 0,
            'totalTimeSeconds': 0
        })
    
    # Start from first waypoint
    previous_point = waypoints[0]
    
    # Calculate segments between waypoints
    for i, waypoint in enumerate(waypoints[1:], 1):
        distance = haversine_distance(
            previous_point['lat'], previous_point['lng'],
            waypoint['lat'], waypoint['lng']
        )
        
        time_seconds = distance / speed
        total_distance += distance
        total_time_seconds += time_seconds
        
        segments.append({
            'fromName': f"Waypoint {i}",
            'toName': f"Waypoint {i + 1}",
            'distance': distance,
            'timeSeconds': time_seconds
        })
        
        previous_point = waypoint
    
    # Return to home if needed
    if return_to_home and len(waypoints) > 0:
        home = waypoints[0]
        last_waypoint = waypoints[-1]
        
        return_distance = haversine_distance(
            last_waypoint['lat'], last_waypoint['lng'],
            home['lat'], home['lng']
        )
        
        return_time = return_distance / speed
        total_distance += return_distance
        total_time_seconds += return_time
        
        segments.append({
            'fromName': f"Waypoint {len(waypoints)}",
            'toName': 'Home',
            'distance': return_distance,
            'timeSeconds': return_time
        })
    
    # Format ETA
    hours = int(total_time_seconds // 3600)
    minutes = int((total_time_seconds % 3600) // 60)
    seconds = int(total_time_seconds % 60)
    eta = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    
    return jsonify({
        'eta': eta,
        'segments': segments,
        'totalDistance': total_distance,
        'totalTimeSeconds': total_time_seconds
    })

if __name__ == '__main__':
    print("ETA Calculation Server is running on http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
