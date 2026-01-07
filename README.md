# 🛰️ Drone Telemetry Control System

A professional-grade GPS drone telemetry and mission control system featuring real-time tracking, waypoint navigation, and direct UART communication via Web Serial API.

![System Architecture](https://img.shields.io/badge/Architecture-ESP32%20%2B%20Web%20Serial-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)

## 🚀 Features

### Real-Time GPS Tracking
- **Live GPS Data**: Real-time position, altitude, speed, and heading
- **Satellite Monitoring**: GPS signal strength and satellite count
- **Direct Communication**: Web Serial API for low-latency data transfer
- **Map Integration**: Interactive satellite imagery with live drone position

### Mission Control
- **Waypoint Navigation**: Click-to-add waypoints with sequential navigation
- **Flight Planning**: Configurable speed, altitude, and mission parameters
- **Return-to-Home**: Automatic or manual return to launch point
- **Progress Tracking**: Real-time mission progress and ETA calculations

### Professional Interface
- **Dark/Light Themes**: Modern, responsive design
- **System Monitoring**: Comprehensive telemetry and status displays
- **Flight Analysis**: Detailed flight time and distance calculations
- **System Logs**: Real-time event logging with filtering

### Hardware Integration
- **ESP32 Firmware**: Optimized for GPS modules and UART communication
- **Web Serial API**: Direct browser-to-hardware communication
- **Offline Operation**: No server required - runs completely in browser
- **Low Latency**: 2-second GPS updates via USB Serial

## 🏗️ Dual UART System Architecture

```
┌─────────────────┐    Web Serial API   ┌─────────────────┐    UART2/GPS     ┌─────────────────┐
│                 │ ◄─────────────────► │                 │ ◄───────────────► │                 │
│  Web Frontend   │    (USB→UART1)      │     ESP32       │   (GPIO 4/2)     │   GPS Module    │
│   (Browser)     │                     │   (Hardware)    │                  │   (Hardware)    │
└─────────────────┘                     └─────────────────┘                  └─────────────────┘
   Control Interface                         Firmware                           GPS Receiver
                                              │
                                              │ UART0/Serial
                                              ▼
                                    ┌─────────────────┐
                                    │ Arduino Serial  │
                                    │    Monitor      │
                                    │  (Debugging)    │
                                    └─────────────────┘
                                      Development Tool
```

## 📁 Project Structure

```
drone-telemetry-system/
├── 🔧 firmware/
│   └── esp32_gps_telemetry.ino    # ESP32 firmware with GPS & UART
├── 🌐 frontend/
│   ├── index.html                 # Main web interface
│   └── assets/
│       ├── css/styles.css         # Professional styling
│       └── js/app.js              # Web Serial API integration
├── 📊 data/
│   ├── gps_data.json             # Sample GPS data format
│   ├── mission_data.json         # Sample mission format
│   └── mission_status.json       # Sample status format
├── 📚 docs/
│   ├── SETUP.md                  # Detailed setup guide
│   └── API.md                    # UART protocol documentation
└── README.md                     # This file
```

## 🚀 Quick Start

### 1. Hardware Setup (Dual UART Configuration)
```
GPS Module → ESP32 (UART2):
VCC        → 3.3V
GND        → GND  
TX         → GPIO 4 (RX2)
RX         → GPIO 2 (TX2)

Computer   → ESP32:
USB Cable  → USB Port (provides both Serial Monitor and Web Serial API)

UART Assignments:
- UART0 (Serial): Arduino Serial Monitor debugging
- UART1 (WebSerial): Browser communication (GPIO 16/17)
- UART2 (GPS): GPS module communication (GPIO 4/2)
```

### 2. Firmware Upload
1. Open `firmware/esp32_gps_telemetry.ino` in Arduino IDE
2. Select ESP32 board and correct COM port
3. Upload firmware to ESP32
4. Open Serial Monitor to verify GPS data

### 3. Web Interface
1. Open `frontend/index.html` in Chrome or Edge browser
2. Click "Connect ESP32" button
3. Select ESP32 COM port from browser dialog
4. Start receiving live GPS telemetry

### 4. Mission Planning
1. Click on map to add waypoints
2. Configure mission settings (speed, altitude)
3. Click "Start Mission" to send to ESP32
4. Monitor real-time navigation progress

## 🛠️ Installation

### Prerequisites
- **Hardware**: ESP32 board, GPS module, USB cable
- **Software**: Arduino IDE, Chrome/Edge browser (Web Serial API support)
- **Libraries**: TinyGPSPlus, ArduinoJson

### Browser Requirements
- **Chrome**: Version 89+ (Web Serial API support)
- **Edge**: Version 89+ (Web Serial API support)
- **Firefox**: Not supported (no Web Serial API)
- **Safari**: Not supported (no Web Serial API)

### Detailed Setup
See [📚 SETUP.md](docs/SETUP.md) for complete installation instructions.

## 📡 UART Protocol

### GPS Telemetry (ESP32 → Browser)
```json
{
    "type": "telemetry",
    "lat": 16.990200,
    "lng": 73.312000,
    "alt": 45.5,
    "sat": 12,
    "speed": 15.2,
    "direction": 135,
    "cardinal": "SE",
    "timestamp": 1234567890
}
```

### Mission Command (Browser → ESP32)
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
    "max_altitude": 50,
    "return_to_home": true,
    "total_waypoints": 1
}
```

### Navigation Update (ESP32 → Browser)
```json
{
    "type": "navigation_update",
    "status": "waypoint_reached",
    "current_waypoint_index": 0,
    "current_lat": 16.991000,
    "current_lng": 73.313000,
    "accuracy_meters": 3.2,
    "timestamp": 1234567890
}
```

## 🎯 Use Cases

### Drone Operations
- **Survey Missions**: Automated area mapping and data collection
- **Inspection Tasks**: Infrastructure monitoring and assessment
- **Search & Rescue**: Coordinated search pattern execution
- **Agriculture**: Crop monitoring and precision agriculture

### Development & Testing
- **GPS Testing**: Validate GPS module performance in real-time
- **Algorithm Development**: Test navigation algorithms with live feedback
- **System Integration**: Prototype drone control systems
- **Educational Projects**: Learn GPS, UART, and Web Serial API

## 🔧 Configuration

### Mission Parameters
- **Speed Range**: 10-25 km/h (configurable via web interface)
- **Altitude Range**: 10-120 meters
- **Waypoint Precision**: 5-meter radius
- **Update Rates**: 2s GPS telemetry via UART

### System Settings
- **Home Coordinates**: Configurable launch point (16.9902, 73.3120)
- **Map Providers**: Google Satellite imagery
- **Serial Baud Rate**: 115200 (ESP32 ↔ Computer)
- **GPS Baud Rate**: 115200 (GPS ↔ ESP32)
- **Theme Options**: Dark/Light mode support

## 🔍 Monitoring & Debugging

### System Health
- **GPS Status**: Signal strength and satellite count
- **Serial Connection**: USB connection status
- **Mission Progress**: Real-time waypoint tracking
- **Performance Metrics**: Update rates and data freshness

### Debug Tools
- **System Logs**: Filtered event logging in web interface
- **Serial Monitor**: ESP32 debug output via Arduino IDE
- **Browser Console**: Web Serial API and JavaScript debugging
- **JSON Validation**: Real-time protocol validation

## 🛡️ Security & Production

### Current Implementation
- Direct UART communication (no network exposure)
- Local browser operation (no server required)
- USB Serial connection (physical access required)

### Production Recommendations
- **Device Access Control**: Restrict USB port access
- **Firmware Validation**: Verify ESP32 firmware integrity
- **Data Validation**: Sanitize all UART inputs
- **Error Handling**: Robust serial communication recovery

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch
3. Test with actual ESP32 hardware
4. Submit pull request

### Code Standards
- **Arduino C++**: Standard ESP32 conventions
- **JavaScript**: ES6+ with Web Serial API best practices
- **CSS**: BEM methodology
- **Documentation**: Update protocol docs with changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **TinyGPSPlus**: Excellent GPS parsing library
- **Leaflet**: Outstanding mapping library
- **ArduinoJson**: Efficient JSON handling for ESP32
- **Web Serial API**: Modern browser-hardware communication
- **Google Maps**: Satellite imagery provider

## 📞 Support

### Documentation
- [📚 Setup Guide](docs/SETUP.md)
- [📚 UART Protocol](docs/API.md)

### Browser Compatibility
- **Supported**: Chrome 89+, Edge 89+
- **Not Supported**: Firefox, Safari (no Web Serial API)
- **Mobile**: Limited support (depends on browser)

### Community
- **Issues**: Report bugs and feature requests
- **Discussions**: Ask questions and share ideas
- **Wiki**: Community-maintained documentation
