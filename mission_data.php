<?php
// mission_data.php
// Direct ESP32 communication - Shared file-based data transfer
// Mission data stored in shared file for immediate ESP32 retrieval

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$response = ['status' => 'error', 'message' => ''];
$missionStateFile = 'mission_state.txt';
$missionDataFile = 'current_mission.json'; // Shared mission data file

// Helper function to read mission data from file
function readMissionData($file) {
    if (file_exists($file)) {
        $content = file_get_contents($file);
        return json_decode($content, true);
    }
    return null;
}

// Helper function to write mission data to file
function writeMissionData($file, $data) {
    return file_put_contents($file, json_encode($data), LOCK_EX);
}

// Handle POST request (Web interface sending mission data OR ESP32 sending status)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the raw POST data
    $postData = file_get_contents('php://input');
    
    // Try to parse as JSON first (for web interface)
    $jsonData = json_decode($postData, true);
    
    if ($jsonData !== null) {
        // JSON data from web interface
        
        // Handle different actions
        if (isset($jsonData['action'])) {
            switch ($jsonData['action']) {
                case 'reset':
                    // Clear mission data file
                    if (file_exists($missionDataFile)) {
                        unlink($missionDataFile);
                    }
                    
                    if (file_exists($missionStateFile)) {
                        unlink($missionStateFile);
                    }
                    $response = [
                        'status' => 'success',
                        'message' => 'Mission reset. ESP32 can retrieve new data.'
                    ];
                    break;
                    
                case 'start_mission':
                    // Store mission data in shared file for ESP32 to retrieve
                    $missionData = [
                        'waypoints' => $jsonData['waypoints'] ?? [],
                        'maxSpeed' => $jsonData['maxSpeed'] ?? 20.0,
                        'maxAltitude' => $jsonData['maxAltitude'] ?? 50.0,
                        'returnToHome' => $jsonData['returnToHome'] ?? true,
                        'missionSent' => false, // Track if ESP32 retrieved it
                        'timestamp' => date('Y-m-d H:i:s')
                    ];
                    
                    // Write to shared file for ESP32 to retrieve
                    if (writeMissionData($missionDataFile, $missionData)) {
                        // Log mission start
                        $timestamp = date('Y-m-d H:i:s');
                        $logEntry = "$timestamp - MISSION_READY - " . count($missionData['waypoints']) . " waypoints (shared file)" . PHP_EOL;
                        file_put_contents($missionStateFile, $logEntry, FILE_APPEND | LOCK_EX);
                        
                        $response = [
                            'status' => 'success',
                            'message' => 'Mission data ready for ESP32 (stored in shared file)',
                            'waypoint_count' => count($missionData['waypoints'])
                        ];
                    } else {
                        $response = [
                            'status' => 'error',
                            'message' => 'Failed to store mission data'
                        ];
                    }
                    break;
            }
        } else {
            // Handle waypoint updates without action field (from updateWaypointsOnServer)
            // Note: These are just preview updates, not mission start
            if (isset($jsonData['waypoints'])) {
                $response = [
                    'status' => 'success',
                    'message' => 'Waypoint preview received (use Start Mission to send to ESP32)'
                ];
            }
        }
        
    } else {
        // Form data from ESP32
        parse_str($postData, $params);
        
        $message = $params['message'] ?? '';
        $status = $params['status'] ?? '';
        
        if (!empty($message) || !empty($status)) {
            // Log ESP32 status
            $timestamp = date('Y-m-d H:i:s');
            $logEntry = "$timestamp - ESP32: $message $status" . PHP_EOL;
            
            if (file_put_contents($missionStateFile, $logEntry, FILE_APPEND | LOCK_EX) !== false) {
                $response = [
                    'status' => 'success',
                    'message' => 'Status received',
                    'timestamp' => $timestamp
                ];
            } else {
                $response['message'] = 'Failed to save status';
            }
        } else {
            $response['message'] = 'No data received';
        }
    }
}

// Handle GET request (ESP32 or Web interface requesting data)
else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    
    // Check if this is an ESP32 request
    $isESP32Request = isset($_GET['esp32']) && $_GET['esp32'] === '1';
    
    if ($isESP32Request) {
        // ESP32 requesting mission data from shared file
        
        $response = [
            'status' => 'success',
            'mission_ready' => false,
            'current_message' => 'Waiting for mission...',
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        // Read mission data from shared file
        $data = readMissionData($missionDataFile);
        
        if ($data !== null && isset($data['waypoints']) && count($data['waypoints']) > 0) {
            
            // Check if mission was already sent to ESP32
            if (!$data['missionSent']) {
                // Format mission data for ESP32 - DIRECT TRANSFER
                $response = [
                    'status' => 'success',
                    'mission_ready' => true,
                    'current_message' => 'New mission available (direct transfer)',
                    'waypoint_count' => count($data['waypoints']),
                    'waypoints' => [],
                    'max_speed' => floatval($data['maxSpeed'] ?? 20.0),
                    'max_altitude' => floatval($data['maxAltitude'] ?? 50.0),
                    'return_to_home' => boolval($data['returnToHome'] ?? true),
                    'mission_end_action' => ($data['returnToHome'] ?? true) ? 'RTH' : 'LAND'
                ];
                
                // Add waypoints with sequential order
                foreach ($data['waypoints'] as $index => $wp) {
                    $response['waypoints'][] = [
                        'sequence' => $index + 1,
                        'lat' => floatval($wp['lat']),
                        'lng' => floatval($wp['lng']),
                        'alt' => floatval($wp['alt'] ?? $data['maxAltitude'] ?? 50.0)
                    ];
                }
                
                // Mark mission as sent by updating the file
                $data['missionSent'] = true;
                writeMissionData($missionDataFile, $data);
                
                // Log mission sent
                $timestamp = date('Y-m-d H:i:s');
                $logEntry = "$timestamp - MISSION_SENT_TO_ESP32 - " . count($data['waypoints']) . " waypoints (direct transfer)" . PHP_EOL;
                file_put_contents($missionStateFile, $logEntry, FILE_APPEND | LOCK_EX);
                
            } else {
                $response = [
                    'status' => 'already_sent',
                    'mission_ready' => false,
                    'current_message' => 'Mission already retrieved',
                    'timestamp' => date('Y-m-d H:i:s')
                ];
            }
        } else {
            $response['current_message'] = 'No mission data available';
        }
        
        // Get mission state history
        if (file_exists($missionStateFile)) {
            $lines = file($missionStateFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if (!empty($lines)) {
                $lastLine = end($lines);
                $parts = explode(' - ', $lastLine, 2);
                $response['last_update'] = $parts[0] ?? '';
            }
        }
        
    } else {
        // Web interface requesting current waypoints from shared file
        $data = readMissionData($missionDataFile);
        
        if ($data !== null) {
            $response = [
                'status' => 'success',
                'waypoints' => $data['waypoints'] ?? [],
                'returnToHome' => $data['returnToHome'] ?? true,
                'maxSpeed' => $data['maxSpeed'] ?? 20.0,
                'maxAltitude' => $data['maxAltitude'] ?? 50.0
            ];
        } else {
            $response = [
                'status' => 'success',
                'waypoints' => [],
                'returnToHome' => true,
                'maxSpeed' => 20.0,
                'maxAltitude' => 50.0
            ];
        }
        
        // Add mission state info
        if (file_exists($missionStateFile)) {
            $lines = file($missionStateFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $response['mission_log'] = array_slice($lines, -5); // Last 5 entries
        }
    }
}

echo json_encode($response);
?>
