/**
 * telemetry.js - Telemetry Data Processing
 * 
 * Handles:
 * - Receiving and parsing telemetry data from ESP32
 * - Updating UAV data panel (battery, altitude, speed, ETA)
 * - Updating telemetry grid (lat, long, heading, altitude AGL)
 * - Processing navigation updates
 * - Processing mission status updates
 * - Validating telemetry data
 */

// ================== TELEMETRY DATA PROCESSING ==================

function handleTelemetryData(jsonData) {
    if (!jsonData || !jsonData.type) return;

    switch (jsonData.type) {
        case 'telemetry':
            if (validateTelemetryData(jsonData)) {
                updateTelemetryDisplay(jsonData);
                if (window.updateDronePosition) {
                    window.updateDronePosition(jsonData.lat, jsonData.lng);
                }
            }
            break;

        case 'mission_confirmation':
            if (window.addLogEntry) {
                window.addLogEntry(`Mission confirmed: ${jsonData.total_waypoints} waypoints`, window.LOG_LEVEL.INFO);
                if (jsonData.mission_id) {
                    window.addLogEntry(`Mission ID: ${jsonData.mission_id}`, window.LOG_LEVEL.INFO);
                }
            }
            break;

        case 'navigation_update':
            handleNavigationUpdate(jsonData);
            break;

        case 'status':
            handleStatusUpdate(jsonData);
            break;

        case 'mission_status':
            handleMissionStatus(jsonData);
            break;

        default:
            if (window.addLogEntry) {
                window.addLogEntry(`Unknown message type: ${jsonData.type}`, window.LOG_LEVEL.WARNING);
            }
    }
}

window.handleTelemetryData = handleTelemetryData;

// ================== TELEMETRY VALIDATION ==================

function validateTelemetryData(data) {
    const requiredFields = ['lat', 'lng', 'alt', 'sat', 'speed'];
    const missingFields = requiredFields.filter(field => data[field] === undefined);

    if (missingFields.length > 0) {
        if (window.addLogEntry) {
            window.addLogEntry(`Invalid telemetry data - missing: ${missingFields.join(', ')}`, window.LOG_LEVEL.WARNING);
        }
        return false;
    }

    if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
        if (window.addLogEntry) {
            window.addLogEntry(`Invalid GPS coordinates: ${data.lat}, ${data.lng}`, window.LOG_LEVEL.WARNING);
        }
        return false;
    }

    return true;
}

// ================== TELEMETRY DISPLAY UPDATE ==================

function updateTelemetryDisplay(data) {
    // Update last telemetry time for connection monitoring
    if (window.lastTelemetryTime !== undefined) {
        window.lastTelemetryTime = Date.now();
    }

    // Update GPS coordinates
    const latElement = document.querySelector('.telemetry-grid .telemetry-item:nth-child(1) span:last-child');
    const lngElement = document.querySelector('.telemetry-grid .telemetry-item:nth-child(2) span:last-child');

    if (latElement) {
        const formattedLat = data.lat.toFixed(6) + '° ' + (data.lat >= 0 ? 'N' : 'S');
        latElement.textContent = formattedLat;
    }

    if (lngElement) {
        const formattedLng = data.lng.toFixed(6) + '° ' + (data.lng >= 0 ? 'E' : 'W');
        lngElement.textContent = formattedLng;
    }

    // Update altitude
    const altElement = document.querySelector('.status-item:nth-child(2) .value');
    if (altElement && data.alt !== undefined) {
        altElement.innerHTML = `${data.alt.toFixed(1)} <small>m</small>`;
    }

    // Update speed
    const speedElement = document.querySelector('.status-item:nth-child(3) .value');
    if (speedElement && data.speed !== undefined) {
        speedElement.innerHTML = `${data.speed.toFixed(1)} <small>km/h</small>`;
    }

    // Update heading
    const headingElement = document.querySelector('.telemetry-grid .telemetry-item:nth-child(3) span:last-child');
    if (headingElement && data.direction !== undefined) {
        const cardinal = data.cardinal || getCardinalDirection(data.direction);
        headingElement.textContent = `${data.direction.toFixed(0)}° ${cardinal}`;
    }

    // Update GPS status
    const gpsStatus = document.querySelector('.gps-status-value');
    if (gpsStatus && data.sat !== undefined) {
        const satCount = data.sat;
        let signalStrength, statusClass;

        if (satCount >= 8) {
            signalStrength = 'Excellent';
            statusClass = 'excellent';
        } else if (satCount >= 6) {
            signalStrength = 'Good';
            statusClass = 'good';
        } else if (satCount >= 4) {
            signalStrength = 'Fair';
            statusClass = 'fair';
        } else {
            signalStrength = 'Poor';
            statusClass = 'poor';
        }

        gpsStatus.textContent = `${signalStrength} (${satCount} satellites)`;
        gpsStatus.className = `gps-status-value ${statusClass}`;

        if (data.hdop !== undefined) {
            const hdopText = ` • HDOP: ${data.hdop.toFixed(1)}`;
            gpsStatus.textContent += hdopText;
        }
    }

    // Update connection status to show live data
    const timestamp = new Date().toLocaleTimeString();
    if (window.updateConnectionStatus) {
        window.updateConnectionStatus('connected', `Live Data • ${timestamp}`);
    }
}

// ================== HELPER FUNCTIONS ==================

function getCardinalDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

// ================== NAVIGATION UPDATES ==================

function handleNavigationUpdate(data) {
    if (!window.addLogEntry) return;

    const status = data.status;
    const waypointIndex = data.current_waypoint_index;

    switch (status) {
        case 'navigation_started':
            window.addLogEntry('Navigation started', window.LOG_LEVEL.INFO);
            break;

        case 'waypoint_reached':
            const accuracy = data.accuracy_meters || 0;
            window.addLogEntry(`Waypoint ${waypointIndex + 1} reached (${accuracy.toFixed(1)}m accuracy)`, window.LOG_LEVEL.INFO);
            break;

        case 'navigating_to':
            window.addLogEntry(`Navigating to waypoint ${waypointIndex + 1}`, window.LOG_LEVEL.INFO);
            break;

        case 'returning_home':
            window.addLogEntry('UAV returning to home', window.LOG_LEVEL.INFO);
            break;

        case 'mission_complete':
            window.addLogEntry('Mission completed successfully!', window.LOG_LEVEL.INFO);
            break;
    }
}

// ================== STATUS UPDATES ==================

function handleStatusUpdate(data) {
    if (!window.addLogEntry || !window.updateConnectionStatus) return;

    const status = data.status;

    switch (status) {
        case 'system_ready':
            window.addLogEntry('System ready', window.LOG_LEVEL.INFO);
            break;

        case 'waiting_gps_fix':
            window.updateConnectionStatus('warning', 'Waiting GPS Fix');
            break;

        case 'emergency_stop':
            window.addLogEntry('Emergency stop activated', window.LOG_LEVEL.WARNING);
            break;

        case 'command_error':
            window.addLogEntry('Command error', window.LOG_LEVEL.ERROR);
            break;

        case 'unknown_command':
            window.addLogEntry('Unknown command received', window.LOG_LEVEL.WARNING);
            break;
    }
}

// ================== MISSION STATUS ==================

function handleMissionStatus(data) {
    if (!window.addLogEntry) return;

    if (data.mission_active) {
        window.addLogEntry(`Mission active: ${data.current_waypoint + 1}/${data.total_waypoints}`, window.LOG_LEVEL.INFO);
    } else {
        window.addLogEntry('No active mission', window.LOG_LEVEL.INFO);
    }
}
