#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

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
            'rtsp_streaming_service': { currentPort: 554, internalPort: 554 },
            'mysql_service': { currentPort: 3306, internalPort: 3306 },
            'cowrie_service': { currentPort: null, internalPort: null } // Uses env vars
        };
    }

    //check if a port is available
    isPortAvailable(port) {
        try {
            const result = execSync(`netstat -tuln | grep ":${port} "`, { encoding: 'utf8' });
            return result.trim() === '';
        } catch (error) {
            //if grep doesnt find anything, the port is available
            return true;
        }
    }

    //get current port for a service
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

    //update port in docker-compose.yml
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
            return true;
        } catch (error) {
            console.error(`Error updating port for ${serviceName}:`, error.message);
            return false;
        }
    }

    //rebuild and recreate a specific container with new port
    rebuildContainer(serviceName) {
        try {
            console.log(`\nRebuilding and recreating ${serviceName} with new port...`);
            
            //stop the container first
            console.log(`⏹Stopping ${serviceName}...`);
            execSync(`sudo docker compose stop ${serviceName}`, { stdio: 'inherit' });
            
            //remove the container to ensure clean recreation
            console.log(`Removing ${serviceName} container...`);
            execSync(`sudo docker compose rm -f ${serviceName}`, { stdio: 'inherit' });
            
            //rebuild and start with new configuration
            console.log(`Rebuilding and starting ${serviceName}...`);
            execSync(`sudo docker compose up -d --build ${serviceName}`, { stdio: 'inherit' });
            
            console.log(`${serviceName} rebuilt and started successfully with new port!`);
            return true;
        } catch (error) {
            console.error(`Failed to rebuild ${serviceName}:`, error.message);
            return false;
        }
    }

    //show current ports
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

    //ask for confirmation
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
            return false;
        }

        //check if port is available
        if (!this.isPortAvailable(newPort)) {
            console.error(`Port ${newPort} is already in use. Please choose a different port.`);
            return false;
        }

        //get current port
        const currentPort = this.getCurrentPort(serviceName);
        if (currentPort === null) {
            console.error(`Could not determine current port for ${serviceName}`);
            return false;
        }

        if (currentPort === newPort) {
            console.log(`${serviceName} is already running on port ${newPort}`);
            return true;
        }

        //ask for confirmation
        const confirmed = await this.askConfirmation(serviceName, currentPort, newPort);
        if (!confirmed) {
            console.log('Port change cancelled by user.');
            return false;
        }

        //update the port
        console.log(`Updating docker-compose.yml...`);
        if (!this.updatePort(serviceName, newPort)) {
            console.error('Failed to update docker-compose.yml');
            return false;
        }

        console.log('Port updated in docker-compose.yml');

        //restart the container
        if (!this.rebuildContainer(serviceName)) {
            console.error('Failed to rebuild container');
            return false;
        }

        console.log(`\n Successfully changed ${serviceName} from port ${currentPort} to port ${newPort}!`);
        return true;
    }

    //show help
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
  - rtsp_streaming_service
  - mysql_service
  - cowrie_service (uses environment variables)
        `);
    }
}

//main execution
async function main() {
    const portManager = new PortManager();
    const args = process.argv.slice(2);

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
                process.exit(1);
            }
            
            const serviceName = args[1];
            const newPort = parseInt(args[2]);
            
            if (isNaN(newPort) || newPort < 1 || newPort > 65535) {
                console.error(' Invalid port number. Port must be between 1 and 65535.');
                process.exit(1);
            }
            
            await portManager.changePort(serviceName, newPort);
            break;
            
        default:
            console.error(`Unknown command: ${command}`);
            portManager.showHelp();
            process.exit(1);
    }
}

//run the main function
if (require.main === module) {
    main().catch(error => {
        console.error(' An error occurred:', error.message);
        process.exit(1);
    });
}

module.exports = PortManager; 