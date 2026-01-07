# UART Protocol Documentation

This document describes the UART communication protocol used between the web interface and ESP32 via Web Serial API.

## Communication Overview

The system uses JSON-formatted messages over UART at 115200 baud rate for bidirectional communication between the browser and ESP32.

## Connection Parameters

```
Baud Rate: 115200
Data Bits: 8
Stop Bits: 1
Parity: None
Flow Control: None
```

## Message Format

All messages are JSON objects terminated with a newline character (`\n`).

### Message Structure
```json
{
  "type": "message_type",
  "data": "message_data",
  "timestamp": 1234567890
}
```

## ESP32 → Browser Messages

### 1. GPS Telemetry Data

**Message Type:** `telemetry`

**Description:** Real-time GPS position, speed, and sensor data sent every 2 seconds.

**Format:**
```json
{
  "type": "telemetry",
  "lat": 16.990200,
  "lng": 73.312000,
  "alt": 45.5,
  "sat": 12,
  "speed": 15.2,
  "hdop": 1.2,
  "direction": 135,
  "cardinal": "SE",
  "gps_datetime": "2025-11-03 10:42:41",
  "timestamp": 1234567890
}
```

**Fields:**
- `lat` (float): Latitude in decimal degrees
- `lng` (float): Longitude in decimal degrees  
- `alt` (float): Altitude in meters above sea level
- `sat` (integer): Number of satellites in view
- `speed` (float): Ground speed in km/h
- `hdop` (float): Horizontal dilution of precision
- `direction` (float): Course over ground in degrees (0-360)
- `cardinal` (string): Cardinal direction (N, NE, E, SE, S, SW, W, NW)
- `gps_datetime` (string): GPS timestamp in YYYY-MM-DD HH:MM:SS format
- `timestamp` (integer): ESP32 system timestamp in milliseconds

### 2. Mission Confirmation

**Message Type:** `mission_confirmation`

**Description:** Sent when ESP32 successfully receives and loads a mission.

**Format:**
```json
{
  "type": "mission_confirmation",
  "mission_id": "2025-11-03 10:42:41",
  "total_waypoints": 3,
  "status": "mission_loaded",
  "timestamp": 1234567890
}
```

**Fields:**
- `mission_id` (string): Unique mission identifier
- `total_waypoints` (integer): Number of waypoints in mission
- `status` (string): Mission loading status
- `timestamp` (integer): ESP32 system timestamp

### 3. Navigation Updates

**Message Type:** `navigation_update`

**Description:** Real-time navigation progress and waypoint status updates.

**Format:**
```json
{
  "type": "navigation_update",
  "mission_id": "2025-11-03 10:42:41",
  "status": "waypoint_reached",
  "current_waypoint_index": 1,
  "total_waypoints": 3,
  "current_lat": 16.990500,
  "current_lng": 73.312500,
  "current_alt": 48.2,
  "waypoint_name": "Waypoint 2",
  "target_lat": 16.990600,
  "target_lng": 73.312600,
  "target_alt": 50.0,
  "accuracy_meters": 3.2,
  "timestamp": 1234567890
}
```

**Status Values:**
- `navigation_started`: Mission navigation has begun
- `navigating_to`: En route to specified waypoint
- `waypoint_reached`: Waypoint successfully reached
- `returning_home`: Returning to launch point
- `mission_complete`: All waypoints completed

**Fields:**
- `mission_id` (string): Mission identifier
- `status` (string): Current navigation status
- `current_waypoint_index` (integer): Index of current target waypoint
- `total_waypoints` (integer): Total waypoints in mission
- `current_lat/lng/alt` (float): Current GPS position
- `waypoint_name` (string): Name of current target waypoint
- `target_lat/lng/alt` (float): Target waypoint coordinates
- `accuracy_meters` (float): Distance accuracy when waypoint reached
- `timestamp` (integer): ESP32 system timestamp

### 4. Status Updates

**Message Type:** `status`

**Description:** General system status and event notifications.

**Format:**
```json
{
  "type": "status",
  "status": "system_ready",
  "timestamp": 1234567890
}
```

**Status Values:**
- `system_ready`: ESP32 initialized and ready
- `waiting_gps_fix`: Waiting for GPS satellite lock
- `emergency_stop`: Emergency stop activated
- `command_error`: Invalid command received
- `unknown_command`: Unrecognized command received

### 5. Mission Status

**Message Type:** `mission_status`

**Description:** Complete mission state information (sent on request).

**Format:**
```json
{
  "type": "mission_status",
  "mission_active": true,
  "mission_state": 2,
  "current_waypoint": 1,
  "total_waypoints": 3,
  "current_waypoint_name": "Waypoint 2",
  "target_lat": 16.990600,
  "target_lng": 73.312600,
  "timestamp": 1234567890
}
```

**Mission States:**
- `0`: WAITING_FOR_MISSION
- `1`: MISSION_LOADED  
- `2`: NAVIGATING
- `3`: MISSION_COMPLETE

## Browser → ESP32 Commands

### 1. Start Mission

**Action:** `start_mission`

**Description:** Send complete mission with waypoints to ESP32.

**Format:**
```json
{
  "action": "start_mission",
  "waypoints": [
    {
      "name": "Waypoint 1",
      "latitude": 16.991000,
      "longitude": 73.313000,
      "altitude": 50
    },
    {
      "name": "Waypoint 2", 
      "latitude": 16.992000,
      "longitude": 73.314000,
      "altitude": 60
    }
  ],
  "max_speed": 20.0,
  "max_altitude": 120,
  "return_to_home": true,
  "total_waypoints": 2
}
```

**Fields:**
- `waypoints` (array): Array of waypoint objects
  - `name` (string): Waypoint identifier
  - `latitude` (float): Waypoint latitude in decimal degrees
  - `longitude` (float): Waypoint longitude in decimal degrees  
  - `altitude` (float): Target altitude in meters
- `max_speed` (float): Maximum speed in km/h (10-25)
- `max_altitude` (integer): Maximum altitude in meters (10-120)
- `return_to_home` (boolean): Return to launch point after mission
- `total_waypoints` (integer): Total number of waypoints

### 2. Get Status

**Action:** `get_status`

**Description:** Request current mission status from ESP32.

**Format:**
```json
{
  "action": "get_status"
}
```

**Response:** ESP32 will send `mission_status` message.

### 3. Emergency Stop

**Action:** `emergency_stop`

**Description:** Immediately abort current mission and stop navigation.

**Format:**
```json
{
  "action": "emergency_stop"
}
```

**Response:** ESP32 will send status update with `emergency_stop` status.

### 4. Return Home

**Action:** `return_home`

**Description:** Abort current mission and return to launch point.

**Format:**
```json
{
  "action": "return_home"
}
```

**Response:** ESP32 will send navigation update with `returning_home` status.

## Communication Flow

### Mission Execution Sequence

1. **Browser** sends `start_mission` command
2. **ESP32** responds with `mission_confirmation`
3. **ESP32** sends `navigation_update` with `navigation_started`
4. **ESP32** continuously sends `telemetry` data (every 2s)
5. **ESP32** sends `navigation_update` with `navigating_to` for each waypoint
6. **ESP32** sends `navigation_update` with `waypoint_reached` when target reached
7. **ESP32** sends `navigation_update` with `mission_complete` when finished

### Error Handling

- Invalid JSON: ESP32 sends `status` with `command_error`
- Unknown command: ESP32 sends `status` with `unknown_command`
- Communication timeout: Browser should reconnect and retry
- GPS signal loss: ESP32 sends `status` with `waiting_gps_fix`

## Data Validation

### ESP32 Input Validation
- JSON format validation
- Waypoint coordinate bounds checking
- Speed/altitude parameter validation
- Command structure verification

### Browser Input Validation  
- Serial port connection status
- JSON parsing error handling
- Timeout detection and recovery
- Data freshness validation

## Example Communication Session

```
Browser → ESP32:
{"action":"start_mission","waypoints":[{"name":"Waypoint 1","latitude":16.991,"longitude":73.313,"altitude":50}],"max_speed":20.0,"return_to_home":true,"total_waypoints":1}

ESP32 → Browser:
{"type":"mission_confirmation","mission_id":"2025-11-03 10:42:41","total_waypoints":1,"status":"mission_loaded","timestamp":1234567890}

ESP32 → Browser:
{"type":"navigation_update","status":"navigation_started","current_waypoint_index":0,"timestamp":1234567891}

ESP32 → Browser (every 2s):
{"type":"telemetry","lat":16.990200,"lng":73.312000,"alt":45.5,"sat":12,"speed":15.2,"timestamp":1234567892}

ESP32 → Browser:
{"type":"navigation_update","status":"waypoint_reached","current_waypoint_index":0,"accuracy_meters":2.8,"timestamp":1234567920}

ESP32 → Browser:
{"type":"navigation_update","status":"mission_complete","timestamp":1234567921}
```

## Performance Characteristics

### Update Rates
- **GPS Telemetry**: 2 second intervals
- **Navigation Updates**: Event-driven (immediate)
- **Status Updates**: 10 second intervals or event-driven
- **Mission Status**: On-demand (request/response)

### Latency
- **Command Response**: < 100ms typical
- **Telemetry Delay**: < 50ms from GPS to browser
- **Navigation Updates**: < 200ms from waypoint detection

### Reliability
- **Error Recovery**: Automatic reconnection on communication failure
- **Data Validation**: JSON schema validation on both ends
- **Timeout Handling**: 5 second command timeout
- **Retry Logic**: 3 retry attempts for failed commands

## Troubleshooting

### Common Issues

1. **No data received**
   - Check baud rate (115200)
   - Verify USB connection
   - Check ESP32 firmware upload

2. **JSON parse errors**
   - Validate message format
   - Check for proper newline termination
   - Verify character encoding (UTF-8)

3. **Command not executed**
   - Check command format against specification
   - Verify ESP32 is in correct state
   - Check for error status responses

4. **Intermittent communication**
   - Check USB cable quality
   - Verify power supply stability
   - Check for electromagnetic interference

### Debug Tools

- **Browser Console**: Check for JavaScript errors and Web Serial API issues
- **Arduino Serial Monitor**: Monitor ESP32 debug output
- **JSON Validators**: Verify message format correctness
- **Protocol Analyzers**: Capture and analyze UART communication

---

**Direct, fast, and reliable - UART communication at its best!**