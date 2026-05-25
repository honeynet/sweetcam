const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = util.promisify(exec);

class RTSPManagementService {
    constructor() {
        this.rtspServices = {
            'rtsp_main': { port: 554, brand: 'auto' },
            'rtsp_hikvision': {
                port: 8554,
                brand: 'hikvision',
                containerName: 'rtsp_h264_publisher_hikvision_101_service',
                composeService: 'rtsp_h264_publisher_hikvision_101',
                fixedPort: true,
                legacyPort: 8655
            },
            'rtsp_dahua': {
                port: 8555,
                brand: 'dahua',
                containerName: 'rtsp_h264_publisher_dahua_service',
                composeService: 'rtsp_h264_publisher_dahua',
                fixedPort: true,
                legacyPort: 8656
            },
            'rtsp_axis': {
                port: 8556,
                brand: 'axis',
                containerName: 'rtsp_h264_publisher_axis_service',
                composeService: 'rtsp_h264_publisher_axis',
                fixedPort: true,
                legacyPort: 8657
            },
            'rtsp_reolink': {
                port: 8557,
                brand: 'reolink',
                containerName: 'rtsp_h264_publisher_reolink_service',
                composeService: 'rtsp_h264_publisher_reolink',
                fixedPort: true,
                legacyPort: 8658
            },
            'rtsp_mobotix': {
                port: 8558,
                brand: 'mobotix',
                containerName: 'rtsp_h264_publisher_mobotix_service',
                composeService: 'rtsp_h264_publisher_mobotix',
                fixedPort: true,
                legacyPort: 8659
            },
            'rtsp_vstarcam': {
                port: 8559,
                brand: 'vstarcam',
                containerName: 'rtsp_h264_publisher_vstarcam_service',
                composeService: 'rtsp_h264_publisher_vstarcam',
                fixedPort: true,
                legacyPort: 8660
            },
            'rtsp_foscam': {
                port: 8560,
                brand: 'foscam',
                containerName: 'rtsp_h264_publisher_foscam_service',
                composeService: 'rtsp_h264_publisher_foscam',
                fixedPort: true,
                legacyPort: null
            }
        };
    }

    getContainerName(serviceName) {
        return this.rtspServices[serviceName]?.containerName || `${serviceName}_service`;
    }

    async executeDockerCommand(command, useSudo = false) {
        try {
            const cleanCommand = command.replace('DOCKER_HOST=unix:///var/run/docker.sock ', '');
            const dockerCommand = useSudo ? `sudo ${cleanCommand}` : cleanCommand;
            
            console.log(`Executing Docker command: ${dockerCommand}`);
            const { stdout, stderr } = await execAsync(dockerCommand, { timeout: 10000 });
            
            if (stderr && !stderr.includes('WARNING')) {
                console.log(`Docker stderr: ${stderr}`);
            }
            
            if (stdout) {
                return { success: true, stdout, stderr };
            }
            
            if (!stderr) {
                return { success: true, stdout: '', stderr: '' };
            }
            
            return { success: true, stdout, stderr };
        } catch (error) {
            console.error(`Docker command failed: ${error.message}`);
            
            if (error.message.includes('permission denied') && !useSudo) {
                console.log('Permission denied, retrying with sudo...');
                return await this.executeDockerCommand(command, true);
            }
            
            if (error.message.includes('_service')) {
                console.log('Command appears to have succeeded despite error message');
                return { success: true, stdout: error.message, stderr: '' };
            }
            
            throw error;
        }
    }

    async getServiceStatus(serviceName) {
        try {
            const containerName = this.getContainerName(serviceName);
            const command = `docker ps --filter "name=${containerName}" --format "table {{.Names}}\t{{.Status}}"`;
            const result = await this.executeDockerCommand(command);
            
            console.log(`Status check output for ${serviceName}:`, result.stdout);
            
            const lines = result.stdout.trim().split('\n');
            
            if (lines.length <= 1) {
                console.log(`No running container found for ${containerName}`);
                return { running: false, status: 'Stopped' };
            }
            
            const statusLine = lines[1];
            console.log(`Status line for ${serviceName}:`, statusLine);
            
            const isRunning = statusLine.includes(containerName) &&
                             !statusLine.includes('Exited') &&
                             !statusLine.includes('Created') &&
                             statusLine.includes('Up');
            
            console.log(`Container ${serviceName}_service running:`, isRunning);
            
            return {
                running: isRunning,
                status: isRunning ? 'Running' : 'Stopped'
            };
        } catch (error) {
            console.error(`Error checking status for ${serviceName}:`, error.message);
            return { running: false, status: 'Error' };
        }
    }

    async getAllServicesStatus() {
        const statuses = {};
        
        for (const [serviceName, config] of Object.entries(this.rtspServices)) {
            statuses[serviceName] = {
                ...config,
                ...(await this.getServiceStatus(serviceName))
            };
        }
        
        return statuses;
    }

    async startService(serviceName) {
        try {
            console.log(`Starting RTSP service: ${serviceName}`);
            const command = `docker start ${this.getContainerName(serviceName)}`;
            const result = await this.executeDockerCommand(command);
            
            console.log(`Start output: ${result.stdout}`);
            return { success: true, message: `${serviceName} started successfully` };
        } catch (error) {
            console.error(`Error starting ${serviceName}:`, error.message);
            return { success: false, message: `Failed to start ${serviceName}: ${error.message}` };
        }
    }

    async stopService(serviceName) {
        try {
            console.log(`Stopping RTSP service: ${serviceName}`);
            const containerName = this.getContainerName(serviceName);
            const command = `docker stop ${containerName}`;
            const result = await this.executeDockerCommand(command);
            
            console.log(`Stop output: ${result.stdout}`);
            
            if (result.stdout && result.stdout.trim() === containerName) {
                return { success: true, message: `${serviceName} stopped successfully` };
            }
            
            //add a small delay to allow the container to fully stop
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            //check if the container actually stopped
            try {
                const status = await this.getServiceStatus(serviceName);
                if (!status.running) {
                    return { success: true, message: `${serviceName} stopped successfully` };
                } else {
                    return { success: false, message: `Failed to stop ${serviceName}: Container is still running` };
                }
            } catch (statusError) {
                console.error(`Error checking status after stop:`, statusError.message);
                //if status check fails but Docker command succeeded, still return success
                return { success: true, message: `${serviceName} stopped successfully` };
            }
        } catch (error) {
            console.error(`Error stopping ${serviceName}:`, error.message);
            
            //even if the command failed, check if the container actually stopped
            try {
                const status = await this.getServiceStatus(serviceName);
                if (!status.running) {
                    return { success: true, message: `${serviceName} stopped successfully` };
                }
            } catch (statusError) {
                console.error(`Error checking status after stop:`, statusError.message);
            }
            
            return { success: false, message: `Failed to stop ${serviceName}: ${error.message}` };
        }
    }

    async toggleService(serviceName) {
        const status = await this.getServiceStatus(serviceName);
        
        if (status.running) {
            return await this.stopService(serviceName);
        } else {
            return await this.startService(serviceName);
        }
    }

    //dynamic port reading from docker-compose.yml
    getCurrentRTSPPorts() {
        try {
            //try multiple possible paths for docker-compose.yml
            const possiblePaths = [
                path.join(__dirname, '../../docker-compose.yml'),
                path.join(__dirname, '../../../docker-compose.yml'),
                '/app/docker-compose.yml',
                '/docker-compose.yml',
                './docker-compose.yml'
            ];
            
            let composeContent = null;
            let composePath = null;
            
            for (const testPath of possiblePaths) {
                try {
                    composeContent = fs.readFileSync(testPath, 'utf8');
                    composePath = testPath;
                    console.log(`Found docker-compose.yml at: ${testPath}`);
                    break;
                } catch (err) {
                    //continue to next path
                }
            }
            
            if (!composeContent) {
                console.log('Could not find docker-compose.yml, using hardcoded ports');
                return this.rtspServices;
            }
            
            const lines = composeContent.split('\n');
            
            const currentPorts = {};
            
            for (const [serviceName, config] of Object.entries(this.rtspServices)) {
                if (config.fixedPort) {
                    currentPorts[serviceName] = { ...config };
                    continue;
                }

                const port = this.getServicePortFromCompose(lines, serviceName);
                if (port) {
                    currentPorts[serviceName] = { ...config, port };
                }
            }
            
            return currentPorts;
        } catch (error) {
            console.error('Error reading docker-compose.yml:', error.message);
            //fallback to hardcoded ports
            return this.rtspServices;
        }
    }

    getServicePortFromCompose(lines, serviceName) {
        let inService = false;
        let serviceLevel = 0;
        
        for (let line of lines) {
            const trimmedLine = line.trim();
            
            //check if we're entering the target service
            if (trimmedLine.startsWith(`${serviceName}:`)) {
                inService = true;
                serviceLevel = (line.match(/^\s*/)[0].length / 2);
                continue;
            }
            
            //check if we're exiting the current service
            if (inService) {
                const currentLevel = (line.match(/^\s*/)[0].length / 2);
                if (currentLevel <= serviceLevel && trimmedLine !== '' && !trimmedLine.startsWith('#')) {
                    inService = false;
                    break;
                }
            }
            
            //match port mappings
            const portMatch = trimmedLine.match(/^\s*-\s*"?(\d+):(\d+)"?$/);
            if (inService && portMatch) {
                return parseInt(portMatch[1]); //return external port
            }
        }
        
        return null;
    }

    getServiceByPort(port) {
        const currentPorts = this.getCurrentRTSPPorts();
        for (const [serviceName, config] of Object.entries(currentPorts)) {
            if (config.port === parseInt(port)) {
                return serviceName;
            }
        }
        return null;
    }

    getServiceByBrand(brand) {
        const currentPorts = this.getCurrentRTSPPorts();
        for (const [serviceName, config] of Object.entries(currentPorts)) {
            if (config.brand === brand) {
                return serviceName;
            }
        }
        return null;
    }

    //get current port for a specific service
    getServicePort(serviceName) {
        const currentPorts = this.getCurrentRTSPPorts();
        return currentPorts[serviceName]?.port || null;
    }

    //get all current RTSP ports for frontend
    getCurrentPortsForFrontend() {
        const currentPorts = this.getCurrentRTSPPorts();
        const portMap = {};
        
        for (const [serviceName, config] of Object.entries(currentPorts)) {
            portMap[serviceName] = config.port;
        }
        
        return portMap;
    }
}

module.exports = new RTSPManagementService();
