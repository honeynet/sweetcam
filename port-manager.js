#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');
const { portManagerLogger } = require('./utils/logger');

class PortManager {
    constructor() {
        this.composeFile = 'docker-compose.yml';
        this.services = {
            'web_service': { currentPort: 3000, internalPort: 3000 },
            'axis_service': { currentPort: 10000, internalPort: 10000 },
            'dahua_service': { currentPort: 37777, internalPort: 37777 },
            'hikvision_service': { currentPort: 80, internalPort: 80 },
            'mobotix_service': { currentPort: 443, internalPort: 443 },
            'reolink_service': { currentPort: 8081, internalPort: 8081 },
            'vstarcam_service': { currentPort: 81, internalPort: 81 },
            'rtsp_main': { currentPort: 554, internalPort: 554 },
            'rtsp_hikvision': { currentPort: 8554, internalPort: 8554 },
            'rtsp_dahua': { currentPort: 8555, internalPort: 8555 },
            'rtsp_axis': { currentPort: 8556, internalPort: 8556 },
            'rtsp_reolink': { currentPort: 8557, internalPort: 8557 },
            'rtsp_mobotix': { currentPort: 8558, internalPort: 8558 },
            'rtsp_vstarcam': { currentPort: 8559, internalPort: 8559 },
            'onvif_service': { currentPort: 3702, internalPort: 3702 },
            'onvif_dahua_service': { currentPort: 3703, internalPort: 3702 },
            'onvif_axis_service': { currentPort: 3704, internalPort: 3702 },
            'onvif_reolink_service': { currentPort: 3705, internalPort: 3702 },
            'onvif_mobotix_service': { currentPort: 3706, internalPort: 3702 },
            'onvif_vstarcam_service': { currentPort: 3707, internalPort: 3702 },
            'mysql_service': { currentPort: 3306, internalPort: 3306 },
            'cowrie_service': { currentPort: null, internalPort: null } // Uses env vars
        };
    }

    isPortAvailable(port) {
        try {
            const result = execSync(`netstat -tuln | grep ":${port} "`, { encoding: 'utf8' });
            const available = result.trim() === '';
            portManagerLogger.logPortCheck(port, available, 'port_manager');
            return available;
        } catch (error) {
            //if grep doesnt find anything, the port is available
            portManagerLogger.logPortCheck(port, true, 'port_manager');
            return true;
        }
    }

    getCurrentPort(serviceName) {
        try {
            const composeContent = fs.readFileSync(this.composeFile, 'utf8');
            const lines = composeContent.split('\n');
            
            let inService = false;
            let currentPort = null;
            let serviceLevel = 0;
            
            for (let line of lines) {
                const originalLine = line;
                const trimmedLine = line.trim();
                
                //check if we're entering a new service
                if (trimmedLine.startsWith(`${serviceName}:`)) {
                    inService = true;
                    serviceLevel = (line.match(/^\s*/)[0].length / 2);
                    continue;
                }
                
                //check if exiting the current service
                if (inService) {
                    const currentLevel = (line.match(/^\s*/)[0].length / 2);
                    if (currentLevel <= serviceLevel && trimmedLine !== '' && !trimmedLine.startsWith('#')) {
                        inService = false;
                        break;
                    }
                }
                
                if (inService && trimmedLine.startsWith('ports:')) {
                    continue;
                }
                
                //match port mappings with dash prefix and quotes
                const portMatch = trimmedLine.match(/^\s*-\s*"?(\d+):(\d+)"?$/);
                if (inService && portMatch) {
                    currentPort = parseInt(portMatch[1]);
                    break;
                }
            }
            
            return currentPort;
        } catch (error) {
            console.error(`Error reading current port for ${serviceName}:`, error.message);
            return null;
        }
    }

    updatePort(serviceName, newPort) {
        try {
            let composeContent = fs.readFileSync(this.composeFile, 'utf8');
            const lines = composeContent.split('\n');
            const newLines = [];
            
            let inService = false;
            let inPorts = false;
            let portUpdated = false;
            let serviceLevel = 0;
            
            for (let line of lines) {
                const originalLine = line;
                const trimmedLine = line.trim();
                
                //check if we're entering the target service
                if (trimmedLine.startsWith(`${serviceName}:`)) {
                    inService = true;
                    serviceLevel = (line.match(/^\s*/)[0].length / 2);
                    newLines.push(originalLine);
                    continue;
                }
                
                //check if we're exiting the current service
                if (inService) {
                    const currentLevel = (line.match(/^\s*/)[0].length / 2);
                    if (currentLevel <= serviceLevel && trimmedLine !== '' && !trimmedLine.startsWith('#')) {
                        inService = false;
                        inPorts = false;
                    }
                }
                
                if (inService && trimmedLine.startsWith('ports:')) {
                    inPorts = true;
                    newLines.push(originalLine);
                    continue;
                }
                
                //match port mappings with dash prefix and quotes
                const portMatch = trimmedLine.match(/^\s*-\s*"?(\d+):(\d+)"?$/);
                if (inService && inPorts && portMatch) {
                    const internalPort = portMatch[2];
                    newLines.push(`      - "${newPort}:${internalPort}"`);
                    portUpdated = true;
                    inPorts = false;
                    continue;
                }
                
                newLines.push(originalLine);
            }
            
            if (!portUpdated) {
                throw new Error(`Could not find port mapping for service ${serviceName}`);
            }
            
            fs.writeFileSync(this.composeFile, newLines.join('\n'));
            portManagerLogger.logConfigChange(serviceName, 'port_update', `Updated to port ${newPort}`, true);
            return true;
        } catch (error) {
            console.error(`Error updating port for ${serviceName}:`, error.message);
            portManagerLogger.logConfigChange(serviceName, 'port_update', error.message, false);
            return false;
        }
    }

    rebuildContainer(serviceName) {
        try {
            console.log(`\nRebuilding and recreating ${serviceName} with new port...`);
            
            console.log(`Stopping ${serviceName}...`);
            portManagerLogger.logContainerOperation('stop', serviceName, 'Stopping container', true);
            execSync(`sudo docker compose stop ${serviceName}`, { stdio: 'inherit' });
            
            console.log(`Removing ${serviceName} container...`);
            portManagerLogger.logContainerOperation('remove', serviceName, 'Removing container', true);
            execSync(`sudo docker compose rm -f ${serviceName}`, { stdio: 'inherit' });
            
            console.log(`Rebuilding and starting ${serviceName}...`);
            portManagerLogger.logContainerOperation('rebuild', serviceName, 'Rebuilding and starting container', true);
            execSync(`sudo docker compose up -d --build ${serviceName}`, { stdio: 'inherit' });
            
            console.log(`${serviceName} rebuilt and started successfully with new port!`);
            portManagerLogger.logServiceOperation('rebuild', serviceName, 'Container rebuilt successfully', true);
            return true;
        } catch (error) {
            console.error(`Failed to rebuild ${serviceName}:`, error.message);
            portManagerLogger.logServiceOperation('rebuild', serviceName, error.message, false);
            return false;
        }
    }

    showCurrentPorts() {
        console.log('\nCurrent Port Configuration:');
        console.log('=' .repeat(50));
        
        for (const [serviceName, config] of Object.entries(this.services)) {
            if (serviceName === 'cowrie_service') {
                console.log(`${serviceName.padEnd(25)} | Uses environment variables`);
            } else {
                const currentPort = this.getCurrentPort(serviceName);
                const status = currentPort ? `Port ${currentPort}` : 'Not configured';
                console.log(`${serviceName.padEnd(25)} | ${status}`);
            }
        }
        console.log('=' .repeat(50));
    }

    async askConfirmation(serviceName, oldPort, newPort) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(`\n Are you sure you want to change ${serviceName} from port ${oldPort} to port ${newPort}? (y/N): `, (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
        });
    }

    //main change port function
    async changePort(serviceName, newPort) {
        console.log(`\nPort Change Request:`);
        console.log(`Service: ${serviceName}`);
        console.log(`New Port: ${newPort}`);

        //check if service exists
        if (!this.services[serviceName]) {
            console.error(`Service '${serviceName}' not found. Available services:`);
            Object.keys(this.services).forEach(service => console.log(`  - ${service}`));
            portManagerLogger.logPortChangeAttempt(serviceName, null, newPort, false, 'Service not found');
            return false;
        }

        if (!this.isPortAvailable(newPort)) {
            console.error(`Port ${newPort} is already in use. Please choose a different port.`);
            portManagerLogger.logPortChangeAttempt(serviceName, null, newPort, false, 'Port already in use');
            return false;
        }

        const currentPort = this.getCurrentPort(serviceName);
        if (currentPort === null) {
            console.error(`Could not determine current port for ${serviceName}`);
            portManagerLogger.logPortChangeAttempt(serviceName, null, newPort, false, 'Could not determine current port');
            return false;
        }

        if (currentPort === newPort) {
            console.log(`${serviceName} is already running on port ${newPort}`);
            portManagerLogger.logPortChangeAttempt(serviceName, currentPort, newPort, true, 'Port already set');
            return true;
        }

        const confirmed = await this.askConfirmation(serviceName, currentPort, newPort);
        if (!confirmed) {
            console.log('Port change cancelled by user.');
            portManagerLogger.logPortChangeAttempt(serviceName, currentPort, newPort, false, 'Cancelled by user');
            return false;
        }

        console.log(`Updating docker-compose.yml...`);
        if (!this.updatePort(serviceName, newPort)) {
            console.error('Failed to update docker-compose.yml');
            portManagerLogger.logPortChangeAttempt(serviceName, currentPort, newPort, false, 'Failed to update docker-compose.yml');
            return false;
        }

        console.log('Port updated in docker-compose.yml');

        if (!this.rebuildContainer(serviceName)) {
            console.error('Failed to rebuild container');
            portManagerLogger.logPortChangeAttempt(serviceName, currentPort, newPort, false, 'Failed to rebuild container');
            return false;
        }

        console.log(`\n Successfully changed ${serviceName} from port ${currentPort} to port ${newPort}!`);
        portManagerLogger.logPortChangeAttempt(serviceName, currentPort, newPort, true, 'Successfully changed port');
        return true;
    }

    showHelp() {
        console.log(`
SweetCam Port Manager

Usage:
  node port-manager.js [command] [options]

Commands:
  list                    Show current port configuration
  change <service> <port> Change port for a specific service
  help                    Show this help message

Examples:
  node port-manager.js list
  node port-manager.js change dahua_service 8080
  node port-manager.js change hikvision_service 8081

Available Services:
  - web_service
  - axis_service
  - dahua_service
  - hikvision_service
  - mobotix_service
  - reolink_service
  - vstarcam_service
  - rtsp_main (main RTSP service)
  - rtsp_hikvision (Hikvision RTSP)
  - rtsp_dahua (Dahua RTSP)
  - rtsp_axis (Axis RTSP)
  - rtsp_reolink (Reolink RTSP)
  - rtsp_mobotix (Mobotix RTSP)
  - rtsp_vstarcam (Vstarcam RTSP)
  - onvif_service (Hikvision ONVIF)
  - onvif_dahua_service (Dahua ONVIF)
  - onvif_axis_service (Axis ONVIF)
  - onvif_reolink_service (Reolink ONVIF)
  - onvif_mobotix_service (Mobotix ONVIF)
  - onvif_vstarcam_service (Vstarcam ONVIF)
  - mysql_service
  - cowrie_service (uses environment variables)
        `);
    }
}

//main execution
async function main() {
    const portManager = new PortManager();
    const args = process.argv.slice(2);

    portManagerLogger.logStartupShutdown('started', 'Port manager started');

    if (args.length === 0 || args[0] === 'help') {
        portManager.showHelp();
        return;
    }

    const command = args[0];

    switch (command) {
        case 'list':
            portManager.showCurrentPorts();
            break;
            
        case 'change':
            if (args.length < 3) {
                console.error(' Usage: node port-manager.js change <service> <port>');
                portManagerLogger.logError(new Error('Invalid arguments'), 'main');
                process.exit(1);
            }
            
            const serviceName = args[1];
            const newPort = parseInt(args[2]);
            
            if (isNaN(newPort) || newPort < 1 || newPort > 65535) {
                console.error(' Invalid port number. Port must be between 1 and 65535.');
                portManagerLogger.logError(new Error('Invalid port number'), 'main');
                process.exit(1);
            }
            
            await portManager.changePort(serviceName, newPort);
            break;
            
        default:
            console.error(`Unknown command: ${command}`);
            portManagerLogger.logError(new Error(`Unknown command: ${command}`), 'main');
            portManager.showHelp();
            process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(' An error occurred:', error.message);
        portManagerLogger.logError(error, 'main');
        process.exit(1);
    });
}

module.exports = PortManager; 