# Setup Guide - Web Serial API Version

This guide will walk you through setting up the drone telemetry system using direct UART communication via Web Serial API.

## Prerequisites

### Hardware Requirements
- ESP32 development board
- GPS module (compatible with NMEA protocol)
- Jumper wires for connections
- USB cable for ESP32 programming and communication
- Computer with USB port

### Software Requirements
- Arduino IDE (version 1.8.0 or later)
- Chrome or Edge browser (Web Serial API support required)
- No web server needed - runs completely offline!

### Browser Compatibility
- ✅ **Chrome 89+** (Full support)
- ✅ **Edge 89+** (Full support)
- ❌ **Firefox** (No Web Serial API support)
- ❌ **Safari** (No Web Serial API support)
- ⚠️ **Mobile browsers** (Limited support)

## Hardware Setup

### Dual UART Hardware Configuration

The system now uses three separate UART channels for optimal performance:

```
GPS Module → ESP32 (UART2):
----------    -----
VCC       →   3.3V
GND       →   GND
TX        →   GPIO 4 (RX2)
RX        →   GPIO 2 (TX2)

UART Assignments:
- UART0 (Serial): Arduino Serial Monitor debugging (USB)
- UART1 (WebSerial): Browser communication (GPIO 16/17)
- UART2 (GPS): GPS module communication (GPIO 4/2)
```

**Key Benefits:**
- ✅ Simultaneous Arduino Serial Monitor and Web Serial API
- ✅ Real-time debugging while browser is connected
- ✅ No port conflicts or communication issues
- ✅ Enhanced development and troubleshooting capabilities

### USB Connection
```
Computer      ESP32
--------      -----
USB Port  →   USB Cable → ESP32 USB Port
```

### Power Supply
- The ESP32 is powered via USB during operation
- No external power supply needed for development
- Ensure stable USB connection for reliable communication

## Software Installation

### 1. Arduino IDE Setup

#### Install ESP32 Board Support
1. Open Arduino IDE
2. Go to **File → Preferences**
3. Add this URL to "Additional Board Manager URLs":
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
4. Go to **Tools → Board → Boards Manager**
5. Search for "ESP32" and install "ESP32 by Espressif Systems"

#### Install Required Libraries
1. Go to **Sketch → Include Library → Manage Libraries**
2. Install the following libraries:
   - **TinyGPSPlus** by Mikal Hart
   - **ArduinoJson** by Benoit Blanchon

### 2. Firmware Configuration and Upload

#### Open Firmware
1. Open `firmware/esp32_gps_telemetry.ino` in Arduino IDE
2. No WiFi configuration needed - communication is via USB Serial

#### Upload Firmware
1. Connect ESP32 to computer via USB
2. Select correct board: **Tools → Board → ESP32 Dev Module**
3. Select correct port: **Tools → Port → [Your ESP32 Port]**
4. Set baud rate: **Tools → Upload Speed → 115200**
5. Click **Upload** button
6. Monitor serial output to verify GPS data reception

#### Verify Dual UART Installation
1. Open **Tools → Serial Monitor**
2. Set baud rate to **115200**
3. You should see:
   ```
   === ESP32 GPS Telemetry System ===
   UART0 (Serial): Debug output to Arduino Serial Monitor
   UART1 (WebSerial): Browser communication via Web Serial API
   UART2 (GPS): GPS module communication
   System ready for dual UART operation
   ```
4. **Keep Serial Monitor open** - it will show debug output while browser is connected

### 3. Web Interface Setup

#### No Server Required!
The system runs completely in the browser - no web server installation needed.

#### Open Web Interface
1. Navigate to the project folder
2. Open `frontend/index.html` directly in Chrome or Edge browser
3. The interface will load immediately

#### Alternative: Local File Server (Optional)
If you prefer a local server for development:
```bash
# Python 3
cd frontend
python -m http.server 8000

# Node.js
cd frontend
npx serve .

# Then open: http://localhost:8000
```

## System Operation

### 1. Connect ESP32 (Dual UART Mode)

#### Enable Web Serial API (if needed)
For Chrome versions < 89, enable the feature:
1. Go to `chrome://flags/`
2. Search for "Experimental Web Platform features"
3. Enable the flag and restart Chrome

#### Connect Hardware with Dual UART
1. Ensure ESP32 is connected via USB
2. **Open Arduino Serial Monitor** (115200 baud) - keep it open for debugging
3. Open the web interface in Chrome/Edge
4. Click **"Connect ESP32"** button
5. Select the ESP32 COM port from the browser dialog
6. **Both interfaces now work simultaneously:**
   - Serial Monitor: Shows debug output and mission progress
   - Browser: Shows telemetry data and mission control
7. Connection status will show "ESP32 Connected"

### 2. Verify GPS Reception
1. Wait for GPS fix (may take 1-2 minutes outdoors)
2. Watch the telemetry panel for live GPS data
3. The map will center on your location automatically
4. GPS status will show satellite count and signal strength

### 3. Mission Planning
1. Click on the map to add waypoints
2. Configure mission settings:
   - Max Speed: 10-25 km/h
   - Max Altitude: 10-120 meters
   - Return to Home: Enable/Disable
3. Click **"Calculate Flight Time"** to see mission analysis

### 4. Mission Execution (with Dual Monitoring)
1. Click **"Start Mission"** to send waypoints to ESP32
2. **Monitor both interfaces simultaneously:**
   - **Serial Monitor**: Mission loading details, waypoint progress, debug info
   - **Browser**: JSON confirmations, live telemetry, mission status
3. ESP32 will confirm mission receipt in both interfaces
4. Watch real-time navigation progress in Serial Monitor
5. Use **"Return Home"** or **"Emergency Stop"** as needed

## Testing the System

### 1. Serial Communication Test
```
Expected ESP32 Output:
{
  "type": "telemetry",
  "lat": 16.990200,
  "lng": 73.312000,
  "alt": 45.5,
  "sat": 12,
  "speed": 0.0,
  "timestamp": 1234567890
}
```

### 2. Mission Command Test
Send from browser to ESP32:
```json
{
  "action": "start_mission",
  "waypoints": [
    {
      "name": "Waypoint 1",
      "latitude": 16.991000,
      "longitude": 73.313000,
      "altitude": 50
    }
  ],
  "max_speed": 20.0,
  "return_to_home": true
}
```

### 3. End-to-End Test
1. Add waypoints on map interface
2. Start mission and verify ESP32 receives data
3. Check system logs for communication status
4. Verify real-time telemetry updates

## Troubleshooting

### GPS Issues
- **No GPS data**: Check wiring, ensure outdoor location with clear sky view
- **Poor accuracy**: Wait for more satellites (8+ recommended)
- **Intermittent data**: Check power supply stability, GPS antenna connection

### Serial Communication Issues
- **Connection failed**: 
  - Verify ESP32 is connected via USB
  - Check COM port in Device Manager (Windows) or `ls /dev/tty*` (Linux/Mac)
  - Try different USB cable or port
  - Restart browser and try again

- **Data not received**:
  - Check baud rate is 115200 on both ends
  - Verify ESP32 firmware uploaded correctly
  - Check browser console for JavaScript errors

### Browser Issues
- **Web Serial API not available**:
  - Use Chrome 89+ or Edge 89+
  - Enable experimental features if needed
  - Check `navigator.serial` is available in console

- **Permission denied**:
  - Grant serial port access when prompted
  - Check browser permissions settings
  - Try refreshing page and reconnecting

### Hardware Issues
- **ESP32 not detected**:
  - Install ESP32 USB drivers
  - Check Device Manager for unknown devices
  - Try different USB cable (data cable, not charge-only)

- **GPS module not working**:
  - Verify 3.3V power supply
  - Check TX/RX connections (TX→RX, RX→TX)
  - Test GPS module separately with GPS test software

## Advanced Configuration

### Custom Home Coordinates
Edit `frontend/assets/js/app.js`:
```javascript
const HOME_COORDINATES = { lat: YOUR_LAT, lng: YOUR_LNG };
```

### Adjust Update Intervals
Edit `firmware/esp32_gps_telemetry.ino`:
```cpp
const unsigned long sendInterval = 2000;        // GPS data interval (ms)
const unsigned long statusUpdateInterval = 10000; // Status update interval (ms)
```

### Custom Serial Baud Rate
Change in both firmware and browser (not recommended):
```cpp
// Firmware
Serial.begin(YOUR_BAUD_RATE);

// Browser (in connectToESP32 function)
await serialPort.open({ baudRate: YOUR_BAUD_RATE });
```

### Debug Mode
Enable verbose logging in firmware:
```cpp
#define DEBUG_MODE 1  // Add at top of file
```

## Production Deployment

### Portable Operation
- The system runs completely offline
- No internet connection required (except for map tiles)
- Copy `frontend/` folder to any computer
- Open `index.html` in supported browser

### Security Considerations
- Physical access to USB port required
- No network exposure (inherently secure)
- Validate all serial input data
- Use signed firmware for production

### Performance Optimization
- Adjust GPS update intervals based on requirements
- Use local map tile cache for offline operation
- Optimize JSON message sizes for faster communication
- Implement data compression for large missions

### Multi-Device Support
- Each ESP32 requires separate USB connection
- Use multiple browser tabs for multiple drones
- Implement device identification in firmware
- Consider USB hub for multiple connections

## Offline Operation

### Map Tiles
- Download map tiles for offline use
- Use local tile server for complete offline operation
- Configure custom tile sources in JavaScript

### Data Storage
- All data stored locally in browser
- No server-side storage required
- Export mission data as JSON files
- Import previous missions from files

## Support

### Common Issues
1. **"Web Serial API not supported"** → Use Chrome/Edge 89+
2. **"No device selected"** → Check USB connection and drivers
3. **"GPS waiting for fix"** → Move to outdoor location with clear sky
4. **"Command error"** → Check JSON format and ESP32 firmware

### Debug Tools
- Browser Developer Console (F12)
- Arduino IDE Serial Monitor
- System logs in web interface
- JSON validation tools

### Getting Help
1. Check browser console for errors
2. Verify ESP32 serial output
3. Test with minimal mission (1 waypoint)
4. Report issues with specific error messages

---

**No servers, no network setup, no complexity - just plug in and fly!**