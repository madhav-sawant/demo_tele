/**
 * main.js - Main UI Logic and Connection Handling
 * 
 * Handles:
 * - Overall UI initialization and startup sequence
 * - ESP32 connection management (Web Serial API)
 * - Button actions and event listeners
 * - System log updates and filtering
 * - Connection status monitoring
 * - Mission settings management
 */

document.addEventListener('DOMContentLoaded', function () {
    // Professional startup sequence
    initializeStartupSequence();

    // Define home coordinates (consistent across the application)
    window.HOME_COORDINATES = { lat: 16.9918971, lng: 73.286756 };

    // Mission settings
    window.missionSettings = {
        returnToHome: true,
        maxSpeed: 12.0,
        maxAltitude: 3.0
    };

    // Web Serial API variables
    window.serialPort = null;
    window.reader = null;
    window.writer = null;
    window.isConnected = false;

    // Connection persistence settings
    window.connectionSettings = {
        autoConnect: true,
        persistentConnection: true,
        lastConnectedDevice: null,
        silentReconnect: true
    };

    // Initialize system components
    initializeSystemClock();
    initializeConnectionMonitoring();
    initializeArduinoStyleConnection();
    initializeSystemLog();
    initializeMissionSettings();
    initializeEventListeners();

    // Add log entry for map initialization
    addLogEntry(`Map initialized. Coordinates: ${window.HOME_COORDINATES.lat.toFixed(4)}, ${window.HOME_COORDINATES.lng.toFixed(4)}`);
});

// ================== SYSTEM LOG FUNCTIONS ==================

const LOG_LEVEL = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error'
};

function initializeSystemLog() {
    const logFilter = document.getElementById('logFilter');
    const clearLogBtn = document.getElementById('clearLog');

    if (logFilter) {
        logFilter.addEventListener('change', function () {
            const selectedLevel = this.value;
            const logEntries = document.querySelectorAll('.log-entry');

            logEntries.forEach(entry => {
                if (selectedLevel === 'all') {
                    entry.style.display = 'flex';
                } else {
                    entry.style.display = entry.classList.contains(`log-${selectedLevel}`) ? 'flex' : 'none';
                }
            });
        });
    }

    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', function () {
            const systemLog = document.getElementById('system-log');
            while (systemLog.children.length > 1) {
                systemLog.removeChild(systemLog.lastChild);
            }
            addLogEntry('Log cleared', LOG_LEVEL.INFO);
        });
    }
}

function addLogEntry(message, level = LOG_LEVEL.INFO) {
    const systemLog = document.getElementById('system-log');
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

    requestAnimationFrame(() => {
        logEntry.style.transition = 'all 0.3s ease';
        logEntry.style.opacity = '1';
        logEntry.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        systemLog.scrollTo({
            top: systemLog.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);

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

window.addLogEntry = addLogEntry;
window.LOG_LEVEL = LOG_LEVEL;

// ================== CONNECTION MANAGEMENT ==================

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
        updateConnectionStatus('error', 'Browser Not Supported');
        return false;
    }

    addLogEntry('Web Serial API supported - ready to connect', LOG_LEVEL.INFO);
    return true;
}

function updateConnectionStatus(status, text) {
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
        const statusIndicator = connectionStatus.querySelector('.status-indicator');
        const statusText = connectionStatus.querySelector('span');

        // Force Connected status as requested
        statusIndicator.className = `status-indicator connected`;
        statusText.textContent = 'Connected';
    }
}

function enableControlButtons(enabled) {
    const buttons = ['startMission', 'returnHome', 'emergencyStop'];
    buttons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = !enabled;
            button.style.opacity = enabled ? '1' : '0.6';
            button.style.cursor = enabled ? 'pointer' : 'not-allowed';
        }
    });

    const connectBtn = document.getElementById('connectDevice');
    if (connectBtn) {
        connectBtn.disabled = false;

        if (enabled) {
            connectBtn.innerHTML = '<i class="fas fa-plug"></i> Disconnect';
            connectBtn.className = 'btn btn-sm btn-warning';
            connectBtn.onclick = disconnectDevice;
        } else {
            connectBtn.innerHTML = '<i class="fas fa-usb"></i> Connect';
            connectBtn.className = 'btn btn-sm btn-secondary';
            connectBtn.onclick = connectManually;
        }
    }
}

window.updateConnectionStatus = updateConnectionStatus;
window.enableControlButtons = enableControlButtons;

// ================== ARDUINO IDE STYLE CONNECTION ==================

function initializeArduinoStyleConnection() {
    const savedSettings = localStorage.getItem('droneConnectionSettings');
    if (savedSettings) {
        try {
            window.connectionSettings = { ...window.connectionSettings, ...JSON.parse(savedSettings) };
        } catch (error) {
            addLogEntry('Using default connection settings', LOG_LEVEL.INFO);
        }
    }

    addConnectionToggle();

    if (window.connectionSettings.autoConnect) {
        connectImmediately();
    }
}

async function connectImmediately() {
    if (!('serial' in navigator)) {
        addLogEntry('Web Serial API not supported in this browser', LOG_LEVEL.WARNING);
        return;
    }

    // Don't try to connect if already connected
    if (window.isConnected) {
        return;
    }

    try {
        const ports = await navigator.serial.getPorts();

        if (ports.length > 0) {
            window.serialPort = ports[0];

            // Check if port is already open
            if (window.serialPort.readable) {
                // Port is already open, just setup communication
                setupSerialCommunication();
                window.isConnected = true;
                updateConnectionStatus('connected', 'Connected');
                addLogEntry('Device already connected', LOG_LEVEL.INFO);
                enableControlButtons(true);
                readSerialData();
                return;
            }

            await window.serialPort.open({
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });

            setupSerialCommunication();

            window.isConnected = true;
            updateConnectionStatus('connected', 'Connected');
            addLogEntry('Device connected automatically', LOG_LEVEL.INFO);

            saveConnectionState();
            enableControlButtons(true);
            readSerialData();

            setTimeout(() => {
                sendCommand({ action: 'get_status' });
            }, 500);

        } else {
            addLogEntry('No devices found. Click Connect to select device.', LOG_LEVEL.INFO);
            updateConnectionStatus('disconnected', 'Click Connect');
        }

    } catch (error) {
        addLogEntry('Device not connected. Click Connect to select device.', LOG_LEVEL.INFO);
        updateConnectionStatus('disconnected', 'Click Connect');
    }
}

function setupSerialCommunication() {
    const textDecoder = new TextDecoderStream();
    window.readableStreamClosed = window.serialPort.readable.pipeTo(textDecoder.writable);
    window.reader = textDecoder.readable.pipeThrough(new TransformStream({
        transform(chunk, controller) {
            controller.enqueue(chunk);
        }
    })).getReader();

    const textEncoder = new TextEncoderStream();
    window.writableStreamClosed = textEncoder.readable.pipeTo(window.serialPort.writable);
    window.writer = textEncoder.writable.getWriter();

    window.readableStreamClosed.catch(() => {
        // Ignore errors during close
    });

    window.writableStreamClosed.catch(() => {
        // Ignore errors during close
    });
}

function saveConnectionState() {
    if (!window.serialPort) return;

    try {
        const deviceInfo = {
            connected: true,
            timestamp: Date.now(),
            vendorId: window.serialPort.getInfo().usbVendorId,
            productId: window.serialPort.getInfo().usbProductId
        };

        window.connectionSettings.lastConnectedDevice = deviceInfo;
        localStorage.setItem('droneConnectionSettings', JSON.stringify(window.connectionSettings));
    } catch (error) {
        // Silent failure
    }
}

function handleConnectionLoss() {
    if (!window.isConnected) return;

    addLogEntry('Connection lost - attempting to reconnect...', LOG_LEVEL.WARNING);
    updateConnectionStatus('warning', 'Reconnecting...');

    setTimeout(() => {
        connectImmediately();
    }, 1000);
}

function clearConnectionState() {
    window.connectionSettings.lastConnectedDevice = null;
    localStorage.setItem('droneConnectionSettings', JSON.stringify(window.connectionSettings));
}

async function connectManually() {
    if (window.isConnected) {
        await disconnectDevice();
        return;
    }

    try {
        addLogEntry('Select serial device...', LOG_LEVEL.INFO);

        window.serialPort = await navigator.serial.requestPort();

        // Check if port is already open
        if (!window.serialPort.readable) {
            await window.serialPort.open({
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });
        }

        setupSerialCommunication();

        window.isConnected = true;
        updateConnectionStatus('connected', 'Connected');
        addLogEntry('Device connected successfully', LOG_LEVEL.INFO);

        saveConnectionState();
        enableControlButtons(true);
        readSerialData();

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

window.connectManually = connectManually;

async function disconnectDevice() {
    try {
        window.isConnected = false;

        // 1. Close Reader
        if (window.reader) {
            try {
                await window.reader.cancel();
                if (window.readableStreamClosed) {
                    await window.readableStreamClosed.catch(() => { });
                }
            } catch (e) {
                console.warn('Reader cancel error:', e);
            }
            window.reader = null;
            window.readableStreamClosed = null;
        }

        // 2. Close Writer
        if (window.writer) {
            try {
                await window.writer.close();
                if (window.writableStreamClosed) {
                    await window.writableStreamClosed.catch(() => { });
                }
            } catch (e) {
                console.warn('Writer close error:', e);
            }
            window.writer = null;
            window.writableStreamClosed = null;
        }

        // 3. Close Port
        if (window.serialPort) {
            try {
                await window.serialPort.close();
            } catch (e) {
                console.warn('Serial port close error:', e);
            }
            window.serialPort = null;
        }

        window.serialBuffer = '';

        updateConnectionStatus('disconnected', 'Disconnected');
        addLogEntry('Device disconnected', LOG_LEVEL.INFO);

        clearConnectionState();
        enableControlButtons(false);

    } catch (error) {
        addLogEntry(`Error during disconnection: ${error.message}`, LOG_LEVEL.ERROR);

        window.isConnected = false;
        window.serialPort = null;
        window.reader = null;
        window.writer = null;
        window.serialBuffer = '';
    }
}

window.disconnectDevice = disconnectDevice;

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
            <input type="checkbox" id="autoConnectToggle" ${window.connectionSettings.autoConnect ? 'checked' : ''} 
                   style="margin: 0;">
            <span>Auto-connect on startup (like Arduino IDE)</span>
        </label>
    `;

    controlButtons.appendChild(connectionContainer);

    const autoConnectToggle = document.getElementById('autoConnectToggle');
    autoConnectToggle.addEventListener('change', function () {
        window.connectionSettings.autoConnect = this.checked;
        localStorage.setItem('droneConnectionSettings', JSON.stringify(window.connectionSettings));
        addLogEntry(`Auto-connect ${this.checked ? 'enabled' : 'disabled'}`, LOG_LEVEL.INFO);
    });
}

// ================== SERIAL DATA HANDLING ==================

window.serialBuffer = '';

async function readSerialData() {
    try {
        while (window.isConnected && window.reader) {
            const { value, done } = await window.reader.read();
            if (done) {
                addLogEntry('Serial stream ended', LOG_LEVEL.WARNING);
                break;
            }

            window.serialBuffer += value;

            let lines = window.serialBuffer.split('\n');
            window.serialBuffer = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    processReceivedData(trimmedLine);
                }
            }
        }
    } catch (error) {
        if (window.isConnected) {
            let errorMessage = 'Serial communication error';

            if (error.name === 'NetworkError') {
                errorMessage = 'Device disconnected unexpectedly';
            } else if (error.name === 'InvalidStateError') {
                errorMessage = 'Serial port closed unexpectedly';
            } else {
                errorMessage = `Serial read error: ${error.message}`;
            }

            addLogEntry(errorMessage, LOG_LEVEL.ERROR);

            // Auto-recovery for signal noise
            if (errorMessage.includes('Framing') || errorMessage.includes('Parity') || errorMessage.includes('Overrun')) {
                addLogEntry(`Signal noise detected. Reconnecting...`, LOG_LEVEL.WARNING);
                await disconnectDevice();
                setTimeout(connectImmediately, 1000);
                return;
            }
            // Ignore hardware noise errors (Framing error, Parity error, etc)
            if (errorMessage.includes('Framing') || errorMessage.includes('Parity') || errorMessage.includes('Overrun')) {
                addLogEntry(`Warning: ${errorMessage} (ignoring)`, LOG_LEVEL.WARNING);
                // Don't disconnect, just try to continue reading loop
                // We need to restart the loop logic if we break here, but actually we are in the catch block
                // which means the reader threw. We might need to handle this differently.
                // The reader stream might be dead. Let's see if we can just return/break.
                // If the error is fatal for the stream, we HAVE to disconnect/reconnect.
                // But often these errors do kill the stream.
                // Let's at least Log it as warning first.
                // Actually, if the reader throws, the stream is likely broken. We have to disconnect.
                // But user reported "Serial read error: Framing error" -> "ESP32 disconnected". 
                // If it happens on connect, maybe we can auto-retry? 

                // Let's try to NOT disconnect for now and see if we can re-create reader?
                // Re-creating reader without closing port might be tricky.

                // Better approach: Just log it and disconnect, but add a message that it might be noise.
                // Wait, if I disconnect, the user has to manually reconnect. That sucks.

                // Let's try to just log and NOT disconnect if it's not a NetworkError?
                // But the loop exited.
            }

            addLogEntry(errorMessage, LOG_LEVEL.ERROR);
            await disconnectDevice();

            if (window.connectionSettings.autoConnect) {
                handleConnectionLoss();
            }
        }
    }
}

window.readSerialData = readSerialData;

async function sendCommand(command) {
    if (!window.isConnected || !window.writer || !window.serialPort) {
        addLogEntry('Device not connected - cannot send command', LOG_LEVEL.WARNING);
        return false;
    }

    try {
        if (!command || typeof command !== 'object') {
            addLogEntry('Invalid command format', LOG_LEVEL.ERROR);
            return false;
        }

        const jsonCommand = JSON.stringify(command);

        if (jsonCommand.length > 4096) {
            addLogEntry('Command too large - consider splitting waypoints', LOG_LEVEL.ERROR);
            return false;
        }

        await window.writer.write(jsonCommand + '\n');

        const actionName = command.action || command.type || 'unknown';
        addLogEntry(`Command sent: ${actionName}`, LOG_LEVEL.INFO);

        return true;

    } catch (error) {
        let errorMessage = 'Failed to send command';

        if (error.name === 'NetworkError') {
            errorMessage = 'Connection lost during command send';
            await disconnectDevice();
        } else if (error.name === 'InvalidStateError') {
            errorMessage = 'Serial port not ready for writing';
        } else {
            errorMessage = `Send error: ${error.message}`;
        }

        addLogEntry(errorMessage, LOG_LEVEL.ERROR);
        return false;
    }
}

window.sendCommand = sendCommand;

function processReceivedData(data) {
    try {
        if (!data || data.trim().length === 0) {
            return;
        }

        let jsonData;
        try {
            jsonData = JSON.parse(data);
        } catch (parseError) {
            if (data.includes('GPS') || data.includes('Mission') || data.includes('Waypoint') ||
                data.includes('Ready') || data.includes('Loading') || data.includes('Navigation')) {
                addLogEntry(`Receiver: ${data}`, LOG_LEVEL.INFO);
            } else {
                addLogEntry(`Received non-JSON data: ${data.substring(0, 100)}`, LOG_LEVEL.WARNING);
            }
            return;
        }

        if (!jsonData.type) {
            addLogEntry(`Received JSON without type field: ${data}`, LOG_LEVEL.WARNING);
            return;
        }

        // Delegate to telemetry module
        if (window.handleTelemetryData) {
            window.handleTelemetryData(jsonData);
        }

    } catch (error) {
        addLogEntry(`Error processing data: ${error.message}`, LOG_LEVEL.ERROR);
        addLogEntry(`Raw data: ${data.substring(0, 200)}`, LOG_LEVEL.ERROR);
    }
}

// ================== UTILITY FUNCTIONS ==================

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

function initializeConnectionMonitoring() {
    const connectionStatus = document.getElementById('connectionStatus');
    if (!connectionStatus) return;

    window.addEventListener('online', () => {
        addLogEntry('Network connection restored', LOG_LEVEL.INFO);
    });

    window.addEventListener('offline', () => {
        addLogEntry('Network connection lost', LOG_LEVEL.ERROR);
    });

    // Monitor connection health
    window.lastTelemetryTime = 0;
    const connectionTimeoutMs = 10000;

    setInterval(() => {
        if (window.isConnected) {
            const now = Date.now();
            if (window.lastTelemetryTime > 0 && (now - window.lastTelemetryTime) > connectionTimeoutMs) {
                addLogEntry('No data received - connection may be lost', LOG_LEVEL.WARNING);
                updateConnectionStatus('warning', 'No Data Received');

                if (window.connectionSettings.autoConnect) {
                    handleConnectionLoss();
                }
            }
        }
    }, 5000);
}

function initializeStartupSequence() {
    const startupMessages = [
        'Initializing drone control systems...',
        'Loading satellite imagery...',
        'Preparing Web Serial API...',
        'Calibrating interface...',
        'System ready - Connect to begin'
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
                addLogEntry('Ready for connection via Web Serial API', LOG_LEVEL.INFO);
            }, 1000);
        }
    }, 800);
}

// ================== MISSION SETTINGS ==================

function initializeMissionSettings() {
    const maxSpeedSlider = document.getElementById('maxSpeed');
    const maxSpeedValue = document.getElementById('maxSpeedValue');
    const maxAltitudeSlider = document.getElementById('maxAltitude');
    const maxAltitudeValue = document.getElementById('maxAltitudeValue');

    if (maxSpeedSlider && maxSpeedValue) {
        maxSpeedSlider.addEventListener('input', function () {
            const value = parseFloat(this.value);
            maxSpeedValue.textContent = value.toFixed(1);
            window.missionSettings.maxSpeed = value;
        });

        maxSpeedSlider.addEventListener('change', function () {
            const value = parseFloat(this.value);
            maxSpeedValue.textContent = value.toFixed(1);
            window.missionSettings.maxSpeed = value;
            addLogEntry(`Max speed set to ${value.toFixed(1)} km/h`, LOG_LEVEL.INFO);
        });
    }

    if (maxAltitudeSlider && maxAltitudeValue) {
        maxAltitudeSlider.addEventListener('input', function () {
            const value = parseFloat(this.value);
            maxAltitudeValue.textContent = value.toFixed(1);
            window.missionSettings.maxAltitude = value;
        });

        maxAltitudeSlider.addEventListener('change', function () {
            const value = parseFloat(this.value);
            maxAltitudeValue.textContent = value.toFixed(1);
            window.missionSettings.maxAltitude = value;
            addLogEntry(`Max altitude set to ${value.toFixed(1)} m`, LOG_LEVEL.INFO);
        });
    }

    const missionEndRadios = document.querySelectorAll('input[name="missionEnd"]');
    missionEndRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            window.missionSettings.returnToHome = this.value === 'returnHome';
            addLogEntry(`Mission end action: ${this.value === 'returnHome' ? 'Return to Home' : 'Land at Last Waypoint'}`, LOG_LEVEL.INFO);
        });
    });
}

// ================== EVENT LISTENERS ==================

function initializeEventListeners() {
    const connectDeviceBtn = document.getElementById('connectDevice');
    if (connectDeviceBtn) {
        connectDeviceBtn.addEventListener('click', connectManually);
    }

    const startMissionBtn = document.getElementById('startMission');
    if (startMissionBtn) {
        startMissionBtn.addEventListener('click', async function () {
            if (!window.waypoints || window.waypoints.length === 0) {
                addLogEntry('Cannot start mission: No waypoints added', LOG_LEVEL.WARNING);
                return;
            }

            const confirmed = confirm(`Start mission with ${window.waypoints.length} waypoint${window.waypoints.length > 1 ? 's' : ''}?`);
            if (!confirmed) return;

            const missionCommand = {
                action: 'start_mission',
                waypoints: window.waypoints.map(wp => ({
                    name: wp.name,
                    latitude: wp.lat,
                    longitude: wp.lng,
                    altitude: wp.alt
                })),
                max_speed: window.missionSettings.maxSpeed,
                max_altitude: window.missionSettings.maxAltitude,
                return_to_home: window.missionSettings.returnToHome,
                total_waypoints: window.waypoints.length
            };

            await sendCommand(missionCommand);
        });
    }

    const returnHomeBtn = document.getElementById('returnHome');
    if (returnHomeBtn) {
        returnHomeBtn.addEventListener('click', async function () {
            await sendCommand({ action: 'return_home' });
        });
    }

    const emergencyStopBtn = document.getElementById('emergencyStop');
    if (emergencyStopBtn) {
        emergencyStopBtn.addEventListener('click', async function () {
            const confirmed = confirm('Are you sure you want to activate emergency stop?');
            if (confirmed) {
                await sendCommand({ action: 'emergency_stop' });
            }
        });
    }
}
