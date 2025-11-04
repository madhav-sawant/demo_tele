document.addEventListener('DOMContentLoaded', function() {
    // Professional startup sequence
    initializeStartupSequence();
    
    // Define home coordinates (consistent across the application)
    const HOME_COORDINATES = { lat: 40.7128, lng: -74.0060 };
    
    // Mission settings
    let missionSettings = {
        returnToHome: true,     // Return to home or land at last waypoint
        maxSpeed: 12.0,         // Max speed in km/h (range: 5-20 km/h)
        maxAltitude: 3.0        // Max altitude in meters (range: 1-5 m)
    };
    
    // Web Serial API variables
    let serialPort = null;
    let reader = null;
    let writer = null;
    let isConnected = false;
    
    // Connection persistence settings - Arduino IDE style
    let connectionSettings = {
        autoConnect: true,           // Always try to connect on startup
        persistentConnection: true,  // Maintain connection state like Arduino IDE
        lastConnectedDevice: null,
        silentReconnect: true       // Connect without user prompts
    };
    
    // Initialize the map
    const map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
        maxZoom: 22
    }).setView([HOME_COORDINATES.lat, HOME_COORDINATES.lng], 15);
    
    // Waypoints array to store mission points
    let waypoints = [];
    
    // Variable to store flight path analysis data
    let flightPathAnalysisData = null;
    
    // Track cursor position for coordinate display
    let cursorPosition = { lat: HOME_COORDINATES.lat, lng: HOME_COORDINATES.lng };
    
    // System log functionality
    const systemLog = document.getElementById('system-log');
    const logFilter = document.getElementById('logFilter');
    const clearLogBtn = document.getElementById('clearLog');
    
    // Log levels
    const LOG_LEVEL = {
        INFO: 'info',
        WARNING: 'warning',
        ERROR: 'error'
    };
    
    // Enhanced log entry with smooth animations and better formatting
    function addLogEntry(message, level = LOG_LEVEL.INFO) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level}`;
        logEntry.style.opacity = '0';
        logEntry.style.transform = 'translateY(-10px)';
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = timestamp;
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = message;
        
        logEntry.appendChild(timeSpan);
        logEntry.appendChild(messageSpan);
        
        systemLog.appendChild(logEntry);
        
        // Smooth entry animation
        requestAnimationFrame(() => {
            logEntry.style.transition = 'all 0.3s ease';
            logEntry.style.opacity = '1';
            logEntry.style.transform = 'translateY(0)';
        });
        
        // Auto-scroll to the bottom with smooth scrolling
        setTimeout(() => {
            systemLog.scrollTo({
                top: systemLog.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
        
        // Limit log entries to 50 for better performance
        if (systemLog.children.length > 50) {
            const oldEntry = systemLog.children[0];
            oldEntry.style.transition = 'all 0.2s ease';
            oldEntry.style.opacity = '0';
            oldEntry.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (systemLog.contains(oldEntry)) {
                    systemLog.removeChild(oldEntry);
                }
            }, 200);
        }
    }
    
    // Filter logs by level
    if (logFilter) {
        logFilter.addEventListener('change', function() {
            const selectedLevel = this.value;
            const logEntries = systemLog.querySelectorAll('.log-entry');
            
            logEntries.forEach(entry => {
                if (selectedLevel === 'all') {
                    entry.style.display = 'flex';
                } else {
                    entry.style.display = entry.classList.contains(`log-${selectedLevel}`) ? 'flex' : 'none';
                }
            });
        });
    }
    
    // Clear log button
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', function() {
            // Keep only the first entry (system initialized)
            while (systemLog.children.length > 1) {
                systemLog.removeChild(systemLog.lastChild);
            }
            addLogEntry('Log cleared', LOG_LEVEL.INFO);
        });
    }
    
    // Initialize system components
    initializeSystemClock();
    initializeConnectionMonitoring();
    initializeArduinoStyleConnection();
    
    // Add log entry for map initialization
    addLogEntry(`Map initialized. Coordinates: ${HOME_COORDINATES.lat.toFixed(4)}, ${HOME_COORDINATES.lng.toFixed(4)}`);
    
    // ================== WEB SERIAL API FUNCTIONS ==================
    
    // Check if Web Serial API is supported with detailed feedback
    function checkWebSerialSupport() {
        if (!('serial' in navigator)) {
            const userAgent = navigator.userAgent;
            let browserInfo = 'Unknown browser';
            
            if (userAgent.includes('Chrome')) {
                const chromeVersion = userAgent.match(/Chrome\/(\d+)/);
                if (chromeVersion && parseInt(chromeVersion[1]) < 89) {
                    browserInfo = `Chrome ${chromeVersion[1]} (requires Chrome 89+)`;
                } else {
                    browserInfo = 'Chrome (Web Serial API disabled)';
                }
            } else if (userAgent.includes('Firefox')) {
                browserInfo = 'Firefox (Web Serial API not supported)';
            } else if (userAgent.includes('Safari')) {
                browserInfo = 'Safari (Web Serial API not supported)';
            } else if (userAgent.includes('Edge')) {
                const edgeVersion = userAgent.match(/Edg\/(\d+)/);
                if (edgeVersion && parseInt(edgeVersion[1]) < 89) {
                    browserInfo = `Edge ${edgeVersion[1]} (requires Edge 89+)`;
                } else {
                    browserInfo = 'Edge (Web Serial API disabled)';
                }
            }
            
            addLogEntry(`Web Serial API not supported. Current browser: ${browserInfo}`, LOG_LEVEL.ERROR);
            addLogEntry('Please use Chrome 89+ or Edge 89+ with Web Serial API enabled', LOG_LEVEL.ERROR);
            
            // Show user-friendly error
            updateConnectionStatus('error', 'Browser Not Supported');
            
            return false;
        }
        
        addLogEntry('Web Serial API supported - ready to connect', LOG_LEVEL.INFO);
        return true;
    }
    
    // Connect to ESP32 via Web Serial API
    async function connectToESP32() {
        if (!checkWebSerialSupport()) return;
        
        try {
            // Check if already connected
            if (isConnected && serialPort) {
                await disconnectFromESP32();
                return;
            }
            
            addLogEntry('Requesting serial port access...', LOG_LEVEL.INFO);
            
            // Request a port and open a connection with proper error handling
            serialPort = await navigator.serial.requestPort({
                filters: [
                    { usbVendorId: 0x10C4, usbProductId: 0xEA60 }, // CP210x
                    { usbVendorId: 0x1A86, usbProductId: 0x7523 }, // CH340
                    { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI
                    { usbVendorId: 0x239A }, // Adafruit boards
                    { usbVendorId: 0x303A }, // Espressif ESP32
                ]
            });
            
            addLogEntry('Opening serial connection...', LOG_LEVEL.INFO);
            
            // Open with proper configuration
            await serialPort.open({ 
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });
            
            // Set up reader and writer with proper stream handling
            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
            reader = textDecoder.readable.pipeThrough(new TransformStream({
                transform(chunk, controller) {
                    // Handle partial lines and ensure complete JSON messages
                    controller.enqueue(chunk);
                }
            })).getReader();
            
            const textEncoder = new TextEncoderStream();
            const writableStreamClosed = textEncoder.readable.pipeTo(serialPort.writable);
            writer = textEncoder.writable.getWriter();
            
            // Handle stream closure properly
            readableStreamClosed.catch(error => {
                if (isConnected) {
                    addLogEntry(`Read stream error: ${error.message}`, LOG_LEVEL.ERROR);
                }
            });
            
            writableStreamClosed.catch(error => {
                if (isConnected) {
                    addLogEntry(`Write stream error: ${error.message}`, LOG_LEVEL.ERROR);
                }
            });
            
            isConnected = true;
            updateConnectionStatus('connected', 'ESP32 Connected');
            addLogEntry('ESP32 connected successfully via USB Serial', LOG_LEVEL.INFO);
            
            // Save connection state for Arduino IDE style persistence
            saveConnectionState();
            
            // Enable control buttons
            enableControlButtons(true);
            
            // Start reading data from ESP32
            readSerialData();
            
            // Send initial status request to verify communication
            setTimeout(() => {
                sendCommand({ action: 'get_status' });
            }, 1000);
            
        } catch (error) {
            let errorMessage = 'Connection failed';
            
            if (error.name === 'NotFoundError') {
                errorMessage = 'No serial port selected. Please select your ESP32 device.';
            } else if (error.name === 'SecurityError') {
                errorMessage = 'Serial port access denied. Please grant permission.';
            } else if (error.name === 'NetworkError') {
                errorMessage = 'Serial port busy or unavailable. Try disconnecting and reconnecting the ESP32.';
            } else if (error.name === 'InvalidStateError') {
                errorMessage = 'Serial port in invalid state. Try refreshing the page.';
            } else {
                errorMessage = `Connection error: ${error.message}`;
            }
            
            addLogEntry(errorMessage, LOG_LEVEL.ERROR);
            updateConnectionStatus('disconnected', 'Connection Failed');
            
            // Reset connection state
            isConnected = false;
            serialPort = null;
            reader = null;
            writer = null;
        }
    }
    
    // Disconnect from ESP32 with proper cleanup
    async function disconnectFromESP32() {
        try {
            isConnected = false;
            
            // Cancel reader first
            if (reader) {
                try {
                    await reader.cancel();
                } catch (e) {
                    console.warn('Reader cancel error:', e);
                }
                reader = null;
            }
            
            // Close writer
            if (writer) {
                try {
                    await writer.close();
                } catch (e) {
                    console.warn('Writer close error:', e);
                }
                writer = null;
            }
            
            // Close serial port
            if (serialPort) {
                try {
                    await serialPort.close();
                } catch (e) {
                    console.warn('Serial port close error:', e);
                }
                serialPort = null;
            }
            
            // Clear serial buffer
            serialBuffer = '';
            
            updateConnectionStatus('disconnected', 'Disconnected');
            addLogEntry('ESP32 disconnected', LOG_LEVEL.INFO);
            
            // Clear saved connection state
            clearConnectionState();
            
            // Disable control buttons
            enableControlButtons(false);
            
        } catch (error) {
            addLogEntry(`Error during disconnection: ${error.message}`, LOG_LEVEL.ERROR);
            
            // Force reset connection state
            isConnected = false;
            serialPort = null;
            reader = null;
            writer = null;
            serialBuffer = '';
        }
    }
    
    // Read data from ESP32 with improved buffer handling
    let serialBuffer = '';
    
    async function readSerialData() {
        try {
            while (isConnected && reader) {
                const { value, done } = await reader.read();
                if (done) {
                    addLogEntry('Serial stream ended', LOG_LEVEL.WARNING);
                    break;
                }
                
                // Add received data to buffer
                serialBuffer += value;
                
                // Process complete lines from buffer
                let lines = serialBuffer.split('\n');
                
                // Keep the last incomplete line in buffer
                serialBuffer = lines.pop() || '';
                
                // Process each complete line
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                        processReceivedData(trimmedLine);
                    }
                }
            }
        } catch (error) {
            if (isConnected) {
                let errorMessage = 'Serial communication error';
                
                if (error.name === 'NetworkError') {
                    errorMessage = 'ESP32 disconnected unexpectedly';
                } else if (error.name === 'InvalidStateError') {
                    errorMessage = 'Serial port closed unexpectedly';
                } else {
                    errorMessage = `Serial read error: ${error.message}`;
                }
                
                addLogEntry(errorMessage, LOG_LEVEL.ERROR);
                await disconnectFromESP32();
                
                // Attempt immediate reconnection like Arduino IDE
                if (connectionSettings.autoConnect) {
                    handleConnectionLoss();
                }
            }
        }
    }
    
    // Send command to ESP32 with validation and retry
    async function sendCommand(command) {
        if (!isConnected || !writer || !serialPort) {
            addLogEntry('ESP32 not connected - cannot send command', LOG_LEVEL.WARNING);
            return false;
        }
        
        try {
            // Validate command structure
            if (!command || typeof command !== 'object') {
                addLogEntry('Invalid command format', LOG_LEVEL.ERROR);
                return false;
            }
            
            const jsonCommand = JSON.stringify(command);
            
            // Check if command is too large
            if (jsonCommand.length > 4096) {
                addLogEntry('Command too large - consider splitting waypoints', LOG_LEVEL.ERROR);
                return false;
            }
            
            // Send command with newline terminator
            await writer.write(jsonCommand + '\n');
            
            const actionName = command.action || command.type || 'unknown';
            addLogEntry(`Command sent: ${actionName}`, LOG_LEVEL.INFO);
            
            return true;
            
        } catch (error) {
            let errorMessage = 'Failed to send command';
            
            if (error.name === 'NetworkError') {
                errorMessage = 'ESP32 connection lost during command send';
                await disconnectFromESP32();
            } else if (error.name === 'InvalidStateError') {
                errorMessage = 'Serial port not ready for writing';
            } else {
                errorMessage = `Send error: ${error.message}`;
            }
            
            addLogEntry(errorMessage, LOG_LEVEL.ERROR);
            return false;
        }
    }
    
    // Process received data from ESP32 with improved error handling
    function processReceivedData(data) {
        try {
            // Skip empty or whitespace-only data
            if (!data || data.trim().length === 0) {
                return;
            }
            
            // Try to parse as JSON first
            let jsonData;
            try {
                jsonData = JSON.parse(data);
            } catch (parseError) {
                // If not valid JSON, treat as debug message from ESP32
                if (data.includes('GPS') || data.includes('Mission') || data.includes('Waypoint') || 
                    data.includes('Ready') || data.includes('Loading') || data.includes('Navigation')) {
                    addLogEntry(`ESP32: ${data}`, LOG_LEVEL.INFO);
                } else {
                    // Log parsing errors for debugging
                    addLogEntry(`Received non-JSON data: ${data.substring(0, 100)}`, LOG_LEVEL.WARNING);
                }
                return;
            }
            
            // Validate JSON structure
            if (!jsonData.type) {
                addLogEntry(`Received JSON without type field: ${data}`, LOG_LEVEL.WARNING);
                return;
            }
            
            // Process based on message type
            switch (jsonData.type) {
                case 'telemetry':
                    if (validateTelemetryData(jsonData)) {
                        updateTelemetryDisplay(jsonData);
                        updateDronePosition(jsonData.lat, jsonData.lng);
                    }
                    break;
                    
                case 'mission_confirmation':
                    addLogEntry(`Mission confirmed by ESP32: ${jsonData.total_waypoints} waypoints`, LOG_LEVEL.INFO);
                    if (jsonData.mission_id) {
                        addLogEntry(`Mission ID: ${jsonData.mission_id}`, LOG_LEVEL.INFO);
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
                    addLogEntry(`Unknown message type: ${jsonData.type}`, LOG_LEVEL.WARNING);
                    addLogEntry(`Full message: ${data}`, LOG_LEVEL.WARNING);
            }
            
        } catch (error) {
            addLogEntry(`Error processing data: ${error.message}`, LOG_LEVEL.ERROR);
            addLogEntry(`Raw data: ${data.substring(0, 200)}`, LOG_LEVEL.ERROR);
        }
    }
    
    // Validate telemetry data structure
    function validateTelemetryData(data) {
        const requiredFields = ['lat', 'lng', 'alt', 'sat', 'speed'];
        const missingFields = requiredFields.filter(field => data[field] === undefined);
        
        if (missingFields.length > 0) {
            addLogEntry(`Invalid telemetry data - missing: ${missingFields.join(', ')}`, LOG_LEVEL.WARNING);
            return false;
        }
        
        // Validate coordinate ranges
        if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
            addLogEntry(`Invalid GPS coordinates: ${data.lat}, ${data.lng}`, LOG_LEVEL.WARNING);
            return false;
        }
        
        return true;
    }
    
    // Update telemetry display with ESP32 data
    function updateTelemetryDisplay(data) {
        // Update last telemetry time for connection monitoring
        lastTelemetryTime = Date.now();
        
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
        
        // Update GPS status with enhanced feedback
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
            
            // Add HDOP information if available
            if (data.hdop !== undefined) {
                const hdopText = ` • HDOP: ${data.hdop.toFixed(1)}`;
                gpsStatus.textContent += hdopText;
            }
        }
        
        // Update connection status to show live data with timestamp
        const timestamp = new Date().toLocaleTimeString();
        updateConnectionStatus('connected', `Live Data • ${timestamp}`);
    }
    
    // Helper function to get cardinal direction from degrees
    function getCardinalDirection(degrees) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    }
    
    // Handle navigation updates from ESP32
    function handleNavigationUpdate(data) {
        const status = data.status;
        const waypointIndex = data.current_waypoint_index;
        
        switch (status) {
            case 'navigation_started':
                addLogEntry('ESP32 started navigation', LOG_LEVEL.INFO);
                break;
                
            case 'waypoint_reached':
                const accuracy = data.accuracy_meters || 0;
                addLogEntry(`Waypoint ${waypointIndex + 1} reached (${accuracy.toFixed(1)}m accuracy)`, LOG_LEVEL.INFO);
                break;
                
            case 'navigating_to':
                addLogEntry(`Navigating to waypoint ${waypointIndex + 1}`, LOG_LEVEL.INFO);
                break;
                
            case 'returning_home':
                addLogEntry('ESP32 returning to home', LOG_LEVEL.INFO);
                break;
                
            case 'mission_complete':
                addLogEntry('Mission completed successfully!', LOG_LEVEL.INFO);
                break;
        }
    }
    
    // Handle status updates from ESP32
    function handleStatusUpdate(data) {
        const status = data.status;
        
        switch (status) {
            case 'system_ready':
                addLogEntry('ESP32 system ready', LOG_LEVEL.INFO);
                break;
                
            case 'waiting_gps_fix':
                updateConnectionStatus('warning', 'Waiting GPS Fix');
                break;
                
            case 'emergency_stop':
                addLogEntry('Emergency stop activated on ESP32', LOG_LEVEL.WARNING);
                break;
                
            case 'command_error':
                addLogEntry('ESP32 command error', LOG_LEVEL.ERROR);
                break;
                
            case 'unknown_command':
                addLogEntry('ESP32 received unknown command', LOG_LEVEL.WARNING);
                break;
        }
    }
    
    // Handle mission status from ESP32
    function handleMissionStatus(data) {
        if (data.mission_active) {
            addLogEntry(`Mission active: ${data.current_waypoint + 1}/${data.total_waypoints}`, LOG_LEVEL.INFO);
        } else {
            addLogEntry('No active mission on ESP32', LOG_LEVEL.INFO);
        }
    }
    
    // Update drone position on map
    function updateDronePosition(lat, lng) {
        if (droneMarker) {
            droneMarker.setLatLng([lat, lng]);
            
            // Center map on GPS location if it's the first valid reading
            if (!window.gpsLocationSet) {
                map.setView([lat, lng], 18);
                addLogEntry(`GPS lock acquired! Centered map on live location`, LOG_LEVEL.INFO);
                window.gpsLocationSet = true;
            }
        }
    }
    
    // Update connection status display
    function updateConnectionStatus(status, text) {
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            const statusIndicator = connectionStatus.querySelector('.status-indicator');
            const statusText = connectionStatus.querySelector('span');
            
            statusIndicator.className = `status-indicator ${status}`;
            statusText.textContent = text;
        }
    }
    
    // Enable/disable control buttons based on connection status
    function enableControlButtons(enabled) {
        const buttons = ['startMission', 'returnHome', 'emergencyStop'];
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = !enabled;
                
                // Visual feedback for disabled state
                if (enabled) {
                    button.style.opacity = '1';
                    button.style.cursor = 'pointer';
                } else {
                    button.style.opacity = '0.6';
                    button.style.cursor = 'not-allowed';
                }
            }
        });
        
        // Update connect button with Arduino IDE style behavior
        const connectBtn = document.getElementById('connectESP32');
        if (connectBtn) {
            connectBtn.disabled = false; // Always enable connect button
            
            if (enabled) {
                connectBtn.innerHTML = '<i class="fas fa-plug"></i> Disconnect ESP32';
                connectBtn.className = 'btn btn-warning';
                connectBtn.onclick = disconnectFromESP32;
            } else {
                connectBtn.innerHTML = '<i class="fas fa-usb"></i> Connect ESP32';
                connectBtn.className = 'btn btn-secondary';
                connectBtn.onclick = connectManually;
            }
        }
    }
    
    // Add connection retry mechanism
    let connectionRetryCount = 0;
    const maxRetries = 3;
    
    async function retryConnection() {
        if (connectionRetryCount < maxRetries) {
            connectionRetryCount++;
            addLogEntry(`Connection retry ${connectionRetryCount}/${maxRetries}...`, LOG_LEVEL.INFO);
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
                await connectToESP32();
                connectionRetryCount = 0; // Reset on success
            } catch (error) {
                if (connectionRetryCount >= maxRetries) {
                    addLogEntry('Maximum connection retries reached. Please check ESP32 connection.', LOG_LEVEL.ERROR);
                    connectionRetryCount = 0;
                } else {
                    retryConnection();
                }
            }
        }
    }
    
    // Monitor connection health
    let lastTelemetryTime = 0;
    const connectionTimeoutMs = 10000; // 10 seconds
    
    function monitorConnectionHealth() {
        if (isConnected) {
            const now = Date.now();
            if (lastTelemetryTime > 0 && (now - lastTelemetryTime) > connectionTimeoutMs) {
                addLogEntry('No data received from ESP32 - connection may be lost', LOG_LEVEL.WARNING);
                updateConnectionStatus('warning', 'No Data Received');
                
                // Attempt immediate reconnection like Arduino IDE
                if (connectionSettings.autoConnect) {
                    handleConnectionLoss();
                }
            }
        }
    }
    
    // Start connection monitoring
    setInterval(monitorConnectionHealth, 5000);
    
    // ================== ARDUINO IDE STYLE CONNECTION ==================
    
    // Initialize Arduino IDE style connection system
    function initializeArduinoStyleConnection() {
        // Load connection settings from localStorage
        const savedSettings = localStorage.getItem('droneConnectionSettings');
        if (savedSettings) {
            try {
                connectionSettings = { ...connectionSettings, ...JSON.parse(savedSettings) };
            } catch (error) {
                addLogEntry('Using default connection settings', LOG_LEVEL.INFO);
            }
        }
        
        // Add connection toggle to UI
        addConnectionToggle();
        
        // Immediately attempt connection like Arduino IDE
        if (connectionSettings.autoConnect) {
            // Connect immediately without delay - like Arduino IDE
            connectImmediately();
        }
    }
    
    // Connect immediately like Arduino IDE - no delays, no prompts
    async function connectImmediately() {
        if (!('serial' in navigator)) {
            addLogEntry('Web Serial API not supported in this browser', LOG_LEVEL.WARNING);
            return;
        }
        
        try {
            // Get previously connected ports (like Arduino IDE remembers devices)
            const ports = await navigator.serial.getPorts();
            
            if (ports.length > 0) {
                // Use the first available port (most recent)
                serialPort = ports[0];
                
                // Connect silently like Arduino IDE
                await serialPort.open({ 
                    baudRate: 115200,
                    dataBits: 8,
                    stopBits: 1,
                    parity: 'none',
                    flowControl: 'none'
                });
                
                // Set up communication
                setupSerialCommunication();
                
                isConnected = true;
                updateConnectionStatus('connected', 'ESP32 Connected');
                addLogEntry('ESP32 connected automatically', LOG_LEVEL.INFO);
                
                // Save connection state
                saveConnectionState();
                
                // Enable controls
                enableControlButtons(true);
                
                // Start reading data
                readSerialData();
                
                // Send initial status request
                setTimeout(() => {
                    sendCommand({ action: 'get_status' });
                }, 500);
                
            } else {
                // No previously connected devices - show connect button
                addLogEntry('No ESP32 devices found. Click Connect to select device.', LOG_LEVEL.INFO);
                updateConnectionStatus('disconnected', 'Click Connect ESP32');
            }
            
        } catch (error) {
            // Silent failure - just show connect button like Arduino IDE
            addLogEntry('ESP32 not connected. Click Connect to select device.', LOG_LEVEL.INFO);
            updateConnectionStatus('disconnected', 'Click Connect ESP32');
        }
    }
    
    // Setup serial communication streams
    function setupSerialCommunication() {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.pipeThrough(new TransformStream({
            transform(chunk, controller) {
                controller.enqueue(chunk);
            }
        })).getReader();
        
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(serialPort.writable);
        writer = textEncoder.writable.getWriter();
        
        // Handle stream errors silently
        readableStreamClosed.catch(() => {
            if (isConnected) {
                handleConnectionLoss();
            }
        });
        
        writableStreamClosed.catch(() => {
            if (isConnected) {
                handleConnectionLoss();
            }
        });
    }
    
    // Save connection state like Arduino IDE
    function saveConnectionState() {
        if (!serialPort) return;
        
        try {
            const deviceInfo = {
                connected: true,
                timestamp: Date.now(),
                vendorId: serialPort.getInfo().usbVendorId,
                productId: serialPort.getInfo().usbProductId
            };
            
            connectionSettings.lastConnectedDevice = deviceInfo;
            localStorage.setItem('droneConnectionSettings', JSON.stringify(connectionSettings));
        } catch (error) {
            // Silent failure
        }
    }
    
    // Handle connection loss and attempt immediate reconnection
    function handleConnectionLoss() {
        if (!isConnected) return;
        
        addLogEntry('Connection lost - attempting to reconnect...', LOG_LEVEL.WARNING);
        updateConnectionStatus('warning', 'Reconnecting...');
        
        // Immediate reconnection attempt like Arduino IDE
        setTimeout(() => {
            connectImmediately();
        }, 1000);
    }
    
    // Clear connection state
    function clearConnectionState() {
        connectionSettings.lastConnectedDevice = null;
        localStorage.setItem('droneConnectionSettings', JSON.stringify(connectionSettings));
    }
    
    // Manual connection when user clicks Connect button
    async function connectManually() {
        if (isConnected) {
            // Disconnect if already connected
            await disconnectFromESP32();
            return;
        }
        
        try {
            addLogEntry('Select ESP32 device...', LOG_LEVEL.INFO);
            
            // Request port selection from user
            serialPort = await navigator.serial.requestPort({
                filters: [
                    { usbVendorId: 0x10C4, usbProductId: 0xEA60 }, // CP210x
                    { usbVendorId: 0x1A86, usbProductId: 0x7523 }, // CH340
                    { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI
                    { usbVendorId: 0x239A }, // Adafruit boards
                    { usbVendorId: 0x303A }, // Espressif ESP32
                ]
            });
            
            // Connect to selected device
            await serialPort.open({ 
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });
            
            // Setup communication
            setupSerialCommunication();
            
            isConnected = true;
            updateConnectionStatus('connected', 'ESP32 Connected');
            addLogEntry('ESP32 connected successfully', LOG_LEVEL.INFO);
            
            // Save connection state for future automatic connection
            saveConnectionState();
            
            // Enable controls
            enableControlButtons(true);
            
            // Start reading data
            readSerialData();
            
            // Send initial status request
            setTimeout(() => {
                sendCommand({ action: 'get_status' });
            }, 500);
            
        } catch (error) {
            let errorMessage = 'Connection failed';
            
            if (error.name === 'NotFoundError') {
                errorMessage = 'No device selected';
            } else if (error.name === 'SecurityError') {
                errorMessage = 'Permission denied';
            } else if (error.name === 'NetworkError') {
                errorMessage = 'Device busy or unavailable';
            } else {
                errorMessage = `Connection error: ${error.message}`;
            }
            
            addLogEntry(errorMessage, LOG_LEVEL.ERROR);
            updateConnectionStatus('disconnected', 'Connection Failed');
        }
    }
    
    // Add simple connection toggle like Arduino IDE
    function addConnectionToggle() {
        const controlButtons = document.querySelector('.control-buttons');
        if (!controlButtons) return;
        
        const connectionContainer = document.createElement('div');
        connectionContainer.className = 'connection-container';
        connectionContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.15);
        `;
        
        connectionContainer.innerHTML = `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px;">
                <input type="checkbox" id="autoConnectToggle" ${connectionSettings.autoConnect ? 'checked' : ''} 
                       style="margin: 0;">
                <span>Auto-connect on startup (like Arduino IDE)</span>
            </label>
        `;
        
        controlButtons.appendChild(connectionContainer);
        
        // Add event listener
        const autoConnectToggle = document.getElementById('autoConnectToggle');
        autoConnectToggle.addEventListener('change', function() {
            connectionSettings.autoConnect = this.checked;
            localStorage.setItem('droneConnectionSettings', JSON.stringify(connectionSettings));
            addLogEntry(`Auto-connect ${this.checked ? 'enabled' : 'disabled'}`, LOG_LEVEL.INFO);
        });
    }
    

    
    // ================== EVENT LISTENERS ==================
    
    // Connect ESP32 button
    const connectESP32Btn = document.getElementById('connectESP32');
    if (connectESP32Btn) {
        connectESP32Btn.addEventListener('click', connectManually);
    }
    
    // Start Mission button
    const startMissionBtn = document.getElementById('startMission');
    if (startMissionBtn) {
        startMissionBtn.addEventListener('click', async function() {
            if (waypoints.length === 0) {
                addLogEntry('Cannot start mission: No waypoints added', LOG_LEVEL.WARNING);
                return;
            }
            
            const confirmed = confirm(`Start mission with ${waypoints.length} waypoint${waypoints.length > 1 ? 's' : ''}?`);
            if (!confirmed) return;
            
            const missionCommand = {
                action: 'start_mission',
                waypoints: waypoints.map(wp => ({
                    name: wp.name,
                    latitude: wp.lat,
                    longitude: wp.lng,
                    altitude: wp.alt
                })),
                max_speed: missionSettings.maxSpeed,
                max_altitude: missionSettings.maxAltitude,
                return_to_home: missionSettings.returnToHome,
                total_waypoints: waypoints.length
            };
            
            await sendCommand(missionCommand);
        });
    }
    
    // Return Home button
    const returnHomeBtn = document.getElementById('returnHome');
    if (returnHomeBtn) {
        returnHomeBtn.addEventListener('click', async function() {
            await sendCommand({ action: 'return_home' });
        });
    }
    
    // Emergency Stop button
    const emergencyStopBtn = document.getElementById('emergencyStop');
    if (emergencyStopBtn) {
        emergencyStopBtn.addEventListener('click', async function() {
            const confirmed = confirm('Are you sure you want to activate emergency stop?');
            if (confirmed) {
                await sendCommand({ action: 'emergency_stop' });
            }
        });
    } 
   // ================== MAP AND UI FUNCTIONS ==================
    
    // Flight Time Analysis Modal functionality
    const flightTimeModal = document.getElementById('flightTimeModal');
    const flightTimeAnalysisContent = document.getElementById('flightTimeAnalysisContent');
    const calculateFlightTimeBtn = document.getElementById('calculateFlightTime');
    const flightTimeCloseBtn = document.querySelector('.close-btn');
    
    // Show the modal when the Calculate Flight Time button is clicked
    calculateFlightTimeBtn.addEventListener('click', async function() {
        if (waypoints.length === 0) {
            addLogEntry('Cannot calculate flight time: No waypoints added');
            flightTimeAnalysisContent.innerHTML = '<div class="no-waypoints">No waypoints have been added yet. Add waypoints to see flight path analysis.</div>';
            flightTimeModal.style.display = 'flex';
            return;
        }
        
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';
        
        try {
            const eta = await calculateETA();
            document.querySelector('.eta-value').innerHTML = eta;
            
            flightPathAnalysisData = calculateETALocally(waypoints, missionSettings.maxSpeed, missionSettings.returnToHome);
            flightTimeAnalysisContent.innerHTML = formatFlightPathAnalysis();
            flightTimeModal.style.display = 'flex';
            
            addLogEntry('Flight time analysis calculated and displayed');
        } catch (error) {
            flightTimeAnalysisContent.innerHTML = `<div class="error-message">Error calculating flight time: ${error.message}</div>`;
            flightTimeModal.style.display = 'flex';
            addLogEntry(`Error calculating flight time: ${error.message}`);
        } finally {
            this.innerHTML = '<i class="fas fa-clock"></i> Calculate Flight Time';
        }
    });
    
    // Close the modal when the close button is clicked
    flightTimeCloseBtn.addEventListener('click', function() {
        flightTimeModal.style.display = 'none';
    });
    
    // Close the modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === flightTimeModal) {
            flightTimeModal.style.display = 'none';
        }
    });
    
    // Calculate estimated time of arrival using local calculation
    async function calculateETA() {
        if (waypoints.length === 0) return '--:--:--';
        
        try {
            const currentSpeed = document.getElementById('maxSpeed')?.value || missionSettings.maxSpeed;
            missionSettings.maxSpeed = parseFloat(currentSpeed);
            
            const etaData = calculateETALocally(waypoints, missionSettings.maxSpeed, missionSettings.returnToHome);
            flightPathAnalysisData = etaData;
            
            return etaData.eta;
        } catch (error) {
            console.error('Error calculating ETA:', error);
            addLogEntry(`ETA calculation error: ${error.message}`);
            return calculateFallbackETA();
        }
    }
    
    // Calculate ETA locally
    function calculateETALocally(waypoints, speedKmh, returnToHome) {
        const speed = speedKmh / 3.6; // Convert to m/s
        const segments = [];
        let totalDistance = 0;
        let totalTimeSeconds = 0;
        
        // Calculate home to first waypoint
        if (waypoints.length > 0) {
            const distanceFromHome = calculateDistance(
                HOME_COORDINATES.lat, HOME_COORDINATES.lng,
                waypoints[0].lat, waypoints[0].lng
            );
            const timeSeconds = distanceFromHome / speed;
            segments.push({
                fromName: 'Home',
                toName: waypoints[0].name,
                distance: distanceFromHome,
                timeSeconds: timeSeconds
            });
            totalDistance += distanceFromHome;
            totalTimeSeconds += timeSeconds;
        }
        
        // Calculate between waypoints
        for (let i = 1; i < waypoints.length; i++) {
            const fromWp = waypoints[i-1];
            const toWp = waypoints[i];
            const distance = calculateDistance(
                fromWp.lat, fromWp.lng,
                toWp.lat, toWp.lng
            );
            const timeSeconds = distance / speed;
            segments.push({
                fromName: fromWp.name,
                toName: toWp.name,
                distance: distance,
                timeSeconds: timeSeconds
            });
            totalDistance += distance;
            totalTimeSeconds += timeSeconds;
        }
        
        // Calculate return to home if needed
        if (returnToHome && waypoints.length > 0) {
            const lastWp = waypoints[waypoints.length - 1];
            const distanceToHome = calculateDistance(
                lastWp.lat, lastWp.lng,
                HOME_COORDINATES.lat, HOME_COORDINATES.lng
            );
            const timeSeconds = distanceToHome / speed;
            segments.push({
                fromName: lastWp.name,
                toName: 'Home',
                distance: distanceToHome,
                timeSeconds: timeSeconds
            });
            totalDistance += distanceToHome;
            totalTimeSeconds += timeSeconds;
        }
        
        return {
            segments: segments,
            totalDistance: totalDistance,
            totalTimeSeconds: totalTimeSeconds,
            eta: formatTime(totalTimeSeconds)
        };
    }
    
    // Provide a fallback ETA
    function calculateFallbackETA() {
        if (waypoints.length === 0) return '--:--:--';
        const estimatedTime = waypoints.length * 60; // 1 minute per waypoint as fallback
        return formatTime(estimatedTime);
    }
    
    // Format time in HH:MM:SS format
    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    // Add Satellite layer
    const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google',
        maxZoom: 22,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    satelliteLayer.on('tileerror', function(error) {
        console.error('Tile error:', error);
        addLogEntry('Map tile loading error. Retrying...', LOG_LEVEL.WARNING);
    });
    
    satelliteLayer.on('load', function() {
        addLogEntry('Satellite imagery loaded successfully', LOG_LEVEL.INFO);
    });
    
    map.on('load', function() {
        addLogEntry('Map fully loaded with all tiles.');
    });
    
    setTimeout(function() {
        map.invalidateSize();
        addLogEntry('Map display refreshed');
    }, 500);
    
    // Map info overlay update functions
    function updateMapInfoOverlay() {
        updateScaleBar();
        updateCameraDistance();
        updateMapCoordinates();
        updateMapAltitude();
    }
    
    function updateScaleBar() {
        const scaleBarText = document.getElementById('scaleBarText');
        if (!scaleBarText) return;
        
        const zoom = map.getZoom();
        const center = map.getCenter();
        const metersPerPixel = 40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom + 8);
        const scaleBarMeters = metersPerPixel * 60;
        
        let displayDistance;
        if (scaleBarMeters < 1000) {
            displayDistance = Math.round(scaleBarMeters) + ' m';
        } else {
            displayDistance = (scaleBarMeters / 1000).toFixed(1) + ' km';
        }
        
        scaleBarText.textContent = displayDistance;
    }
    
    function updateCameraDistance() {
        const cameraDistance = document.getElementById('cameraDistance');
        if (!cameraDistance) return;
        
        const zoom = map.getZoom();
        const center = map.getCenter();
        const altitude = Math.round(40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom + 8) * 500);
        
        let displayAltitude;
        if (altitude < 1000) {
            displayAltitude = altitude + ' m';
        } else {
            displayAltitude = (altitude / 1000).toFixed(1) + ' km';
        }
        
        cameraDistance.textContent = 'Camera: ' + displayAltitude;
    }
    
    function updateMapCoordinates() {
        const mapCoordinates = document.getElementById('mapCoordinates');
        if (!mapCoordinates) return;
        
        const lat = cursorPosition.lat;
        const lng = cursorPosition.lng;
        
        function toDMS(coordinate, isLat) {
            const absolute = Math.abs(coordinate);
            const degrees = Math.floor(absolute);
            const minutesNotTruncated = (absolute - degrees) * 60;
            const minutes = Math.floor(minutesNotTruncated);
            const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
            
            const direction = isLat 
                ? (coordinate >= 0 ? 'N' : 'S')
                : (coordinate >= 0 ? 'E' : 'W');
            
            return `${degrees}°${minutes}'${seconds}"${direction}`;
        }
        
        const latDMS = toDMS(lat, true);
        const lngDMS = toDMS(lng, false);
        
        mapCoordinates.textContent = `${latDMS} ${lngDMS}`;
    }
    
    function updateMapAltitude() {
        const mapAltitude = document.getElementById('mapAltitude');
        if (!mapAltitude) return;
        
        const zoom = map.getZoom();
        const center = map.getCenter();
        const altitude = Math.round(40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom + 8) * 500);
        
        let displayAltitude;
        if (altitude < 1000) {
            displayAltitude = altitude + ' m';
        } else {
            displayAltitude = (altitude / 1000).toFixed(1) + ' km';
        }
        
        mapAltitude.textContent = displayAltitude;
    }
    
    // Optimized map event handlers with throttling
    let mapUpdateTimeout;
    function throttledMapUpdate() {
        clearTimeout(mapUpdateTimeout);
        mapUpdateTimeout = setTimeout(updateMapInfoOverlay, 100);
    }
    
    map.on('move', throttledMapUpdate);
    map.on('zoom', throttledMapUpdate);
    
    // Throttled mouse movement tracking
    let mouseUpdateTimeout;
    map.on('mousemove', function(e) {
        cursorPosition = { lat: e.latlng.lat, lng: e.latlng.lng };
        clearTimeout(mouseUpdateTimeout);
        mouseUpdateTimeout = setTimeout(updateMapCoordinates, 50);
    });
    
    // Enhanced map interaction feedback
    map.on('click', function(e) {
        addWaypoint(e.latlng.lat, e.latlng.lng);
        
        const clickIndicator = L.circleMarker([e.latlng.lat, e.latlng.lng], {
            radius: 10,
            fillColor: '#3498db',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.3
        }).addTo(map);
        
        setTimeout(() => {
            map.removeLayer(clickIndicator);
        }, 1000);
    });
    
    updateMapInfoOverlay();
    
    // Initialize drone marker
    window.gpsLocationSet = false;
    
    const droneIcon = L.divIcon({
        html: '<div style="font-size: 36px; color: #FF5722; text-shadow: 0 0 25px rgba(255, 87, 34, 0.9);">➤</div>',
        className: 'drone-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    
    const droneMarker = L.marker([HOME_COORDINATES.lat, HOME_COORDINATES.lng], {icon: droneIcon, zIndexOffset: 1000}).addTo(map);
    
    // Center map button functionality
    const centerMapBtn = document.getElementById('centerMap');
    if (centerMapBtn) {
        centerMapBtn.addEventListener('click', function() {
            map.setView([HOME_COORDINATES.lat, HOME_COORDINATES.lng], 15);
            addLogEntry('Map centered to home position');
        });
    }
    
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    
    themeToggle.addEventListener('change', function() {
        document.body.classList.toggle('light-theme');
        if (document.body.classList.contains('light-theme')) {
            localStorage.setItem('theme', 'light');
        } else {
            localStorage.setItem('theme', 'dark');
        }
    });
    
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'light') {
        setTimeout(() => {
            document.body.classList.add('light-theme');
            themeToggle.checked = true;
        }, 300);
    }
    
    // System clock functionality
    function initializeSystemClock() {
        const systemTimeElement = document.getElementById('systemTime');
        if (systemTimeElement) {
            function updateClock() {
                const now = new Date();
                const timeString = now.toLocaleTimeString('en-US', { 
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                systemTimeElement.textContent = timeString;
            }
            
            updateClock();
            setInterval(updateClock, 1000);
        }
    }
    
    // Connection monitoring system
    function initializeConnectionMonitoring() {
        const connectionStatus = document.getElementById('connectionStatus');
        if (!connectionStatus) return;
        
        // Monitor actual network connectivity
        window.addEventListener('online', () => {
            addLogEntry('Network connection restored', LOG_LEVEL.INFO);
        });
        
        window.addEventListener('offline', () => {
            addLogEntry('Network connection lost', LOG_LEVEL.ERROR);
        });
    }
    
    // Waypoint management functions
    function addWaypoint(lat, lng, alt) {
        // Use maxAltitude from mission settings if alt not provided
        if (alt === undefined) {
            alt = missionSettings.maxAltitude;
        }
        
        const waypointNumber = waypoints.length + 1;
        const waypoint = {
            lat: lat,
            lng: lng,
            alt: alt,
            name: `Waypoint ${waypointNumber}`
        };
        
        const waypointIcon = L.divIcon({
            html: `<div class="waypoint-number" style="background: #3498db; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${waypointNumber}</div>`,
            className: 'waypoint-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const marker = L.marker([lat, lng], { icon: waypointIcon }).addTo(map);
        marker.bindPopup(`${waypoint.name}<br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}<br>Alt: ${alt}m`);
        
        waypoint.marker = marker;
        waypoints.push(waypoint);
        
        updateWaypointsList();
        addLogEntry(`Added ${waypoint.name} at ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        
        calculateETA().then(eta => {
            document.querySelector('.eta-value').innerHTML = eta;
        });
    }
    
    // updateWaypointsList and removeWaypoint functions are defined later in the code
    

    
    function formatFlightPathAnalysis() {
        if (!flightPathAnalysisData || !flightPathAnalysisData.segments || flightPathAnalysisData.segments.length === 0) {
            if (waypoints.length > 0) {
                return '<div class="waiting-data">Flight path data is being calculated...</div>';
            }
            return '<div class="no-waypoints">No waypoints have been added yet. Add waypoints to see flight path analysis.</div>';
        }
        
        let formattedOutput = '<div class="flight-analysis">';
        formattedOutput += '<h3>Flight Path Analysis</h3>';
        formattedOutput += '<div class="segments-container">';
        
        flightPathAnalysisData.segments.forEach((segment, index) => {
            const minutes = Math.floor(segment.timeSeconds / 60);
            const seconds = Math.floor(segment.timeSeconds % 60);
            
            formattedOutput += `
                <div class="segment">
                    <div class="segment-header">Segment ${index + 1}: ${segment.fromName} to ${segment.toName}</div>
                    <div class="segment-details">
                        <div>Distance: ${(segment.distance / 1000).toFixed(2)} km</div>
                        <div>Time: ${minutes}m ${seconds}s</div>
                    </div>
                </div>
            `;
        });
        
        formattedOutput += '</div>';
        
        const totalHours = Math.floor(flightPathAnalysisData.totalTimeSeconds / 3600);
        const totalMinutes = Math.floor((flightPathAnalysisData.totalTimeSeconds % 3600) / 60);
        const totalSeconds = Math.floor(flightPathAnalysisData.totalTimeSeconds % 60);
        
        formattedOutput += '<div class="analysis-summary">';
        formattedOutput += `<div class="total-distance">Total Distance: ${(flightPathAnalysisData.totalDistance / 1000).toFixed(2)} km</div>`;
        formattedOutput += '<div class="total-time">Total Time: ';
        
        if (totalHours > 0) {
            formattedOutput += `${totalHours}h `;
        }
        formattedOutput += `${totalMinutes}m ${totalSeconds}s</div>`;
        formattedOutput += '</div>';
        formattedOutput += '</div>';
        
        return formattedOutput;
    }
    
    // Calculate distance between two coordinates in meters
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Professional startup sequence
    function initializeStartupSequence() {
        const startupMessages = [
            'Initializing drone control systems...',
            'Loading satellite imagery...',
            'Preparing Web Serial API...',
            'Calibrating interface...',
            'System ready - Connect ESP32 to begin'
        ];
        
        let messageIndex = 0;
        const startupInterval = setInterval(() => {
            if (messageIndex < startupMessages.length - 1) {
                addLogEntry(startupMessages[messageIndex], LOG_LEVEL.INFO);
                messageIndex++;
            } else {
                addLogEntry(startupMessages[messageIndex], LOG_LEVEL.INFO);
                clearInterval(startupInterval);
                
                setTimeout(() => {
                    addLogEntry('Ready for ESP32 connection via Web Serial API', LOG_LEVEL.INFO);
                }, 1000);
            }
        }, 800);
    }
    
    // Clear waypoints button
    const clearWaypointsBtn = document.querySelector('.btn-clear-waypoints');
    if (clearWaypointsBtn) {
        clearWaypointsBtn.addEventListener('click', function() {
            if (waypoints.length === 0) {
                addLogEntry('No waypoints to clear', LOG_LEVEL.INFO);
                return;
            }
            
            const confirmed = confirm(`Clear all ${waypoints.length} waypoint${waypoints.length > 1 ? 's' : ''}?`);
            if (!confirmed) return;
            
            // Remove all markers from map
            waypoints.forEach(waypoint => {
                if (waypoint.marker) {
                    map.removeLayer(waypoint.marker);
                }
            });
            
            // Clear waypoints array
            waypoints = [];
            
            // Update the display
            updateWaypointsList();
            addLogEntry('All waypoints cleared', LOG_LEVEL.INFO);
            
            // Reset ETA display
            const etaElement = document.querySelector('.eta-value');
            if (etaElement) {
                etaElement.textContent = '--:--';
            }
        });
    }
    
    // Mission settings sliders
    const maxSpeedSlider = document.getElementById('maxSpeed');
    const maxSpeedValue = document.getElementById('maxSpeedValue');
    const maxAltitudeSlider = document.getElementById('maxAltitude');
    const maxAltitudeValue = document.getElementById('maxAltitudeValue');
    
    if (maxSpeedSlider && maxSpeedValue) {
        // Update display on input (while sliding)
        maxSpeedSlider.addEventListener('input', function() {
            const value = parseFloat(this.value);
            maxSpeedValue.textContent = value.toFixed(1);
            missionSettings.maxSpeed = value;
        });
        
        // Also update on change (when released)
        maxSpeedSlider.addEventListener('change', function() {
            const value = parseFloat(this.value);
            maxSpeedValue.textContent = value.toFixed(1);
            missionSettings.maxSpeed = value;
            addLogEntry(`Max speed set to ${value.toFixed(1)} km/h`, LOG_LEVEL.INFO);
        });
    }
    
    if (maxAltitudeSlider && maxAltitudeValue) {
        // Update display on input (while sliding)
        maxAltitudeSlider.addEventListener('input', function() {
            const value = parseFloat(this.value);
            maxAltitudeValue.textContent = value.toFixed(1);
            missionSettings.maxAltitude = value;
        });
        
        // Also update on change (when released)
        maxAltitudeSlider.addEventListener('change', function() {
            const value = parseFloat(this.value);
            maxAltitudeValue.textContent = value.toFixed(1);
            missionSettings.maxAltitude = value;
            addLogEntry(`Max altitude set to ${value.toFixed(1)} m`, LOG_LEVEL.INFO);
        });
    }
    
    // Mission end action radio buttons
    const missionEndRadios = document.querySelectorAll('input[name="missionEnd"]');
    missionEndRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            missionSettings.returnToHome = this.value === 'returnHome';
            addLogEntry(`Mission end action: ${this.value === 'returnHome' ? 'Return to Home' : 'Land at Last Waypoint'}`, LOG_LEVEL.INFO);
        });
    });
    
    // Function to update waypoints list display
    function updateWaypointsList() {
        const waypointsList = document.querySelector('.waypoints-list');
        if (!waypointsList) return;
        
        if (waypoints.length === 0) {
            waypointsList.innerHTML = '<div style="color: var(--color-text-secondary); font-size: 0.9rem; padding: 1rem; text-align: center;">No waypoints added. Click on the map to add waypoints.</div>';
            return;
        }
        
        waypointsList.innerHTML = waypoints.map((wp, index) => `
            <div class="waypoint-item">
                <div class="waypoint-number">${index + 1}</div>
                <div class="waypoint-coords">${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}</div>
                <div class="waypoint-alt">${wp.alt.toFixed(1)}m</div>
                <button class="waypoint-delete" onclick="removeWaypoint(${index})" title="Remove waypoint">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }
    
    // Function to remove a waypoint
    window.removeWaypoint = function(index) {
        if (index >= 0 && index < waypoints.length) {
            const waypoint = waypoints[index];
            
            // Remove marker from map
            if (waypoint.marker) {
                map.removeLayer(waypoint.marker);
            }
            
            // Remove from array
            waypoints.splice(index, 1);
            
            // Renumber remaining waypoints and update their markers
            waypoints.forEach((wp, newIndex) => {
                wp.name = `Waypoint ${newIndex + 1}`;
                
                // Update marker icon with new number
                if (wp.marker) {
                    const newIcon = L.divIcon({
                        html: `<div class="waypoint-number" style="background: #3498db; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${newIndex + 1}</div>`,
                        className: 'waypoint-marker',
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });
                    wp.marker.setIcon(newIcon);
                    
                    // Update popup
                    wp.marker.setPopupContent(`${wp.name}<br>Lat: ${wp.lat.toFixed(6)}<br>Lng: ${wp.lng.toFixed(6)}<br>Alt: ${wp.alt}m`);
                }
            });
            
            // Update the list display
            updateWaypointsList();
            addLogEntry(`Removed waypoint ${index + 1}`, LOG_LEVEL.INFO);
            
            // Recalculate ETA
            calculateETA().then(eta => {
                const etaElement = document.querySelector('.eta-value');
                if (etaElement) {
                    etaElement.innerHTML = eta;
                }
            });
        }
    };
    
    // Initialize waypoints list
    updateWaypointsList();
});