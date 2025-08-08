const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = util.promisify(exec);

class ONVIFManagementService {
    constructor() {
        this.onvifServices = {
            'onvif_service': { port: 8080, brand: 'hikvision' },
            'onvif_dahua_service': { port: 8086, brand: 'dahua' },
            'onvif_axis_service': { port: 8087, brand: 'axis' },
            'onvif_reolink_service': { port: 8088, brand: 'reolink' },
            'onvif_mobotix_service': { port: 8089, brand: 'mobotix' },
            'onvif_vstarcam_service': { port: 8090, brand: 'vstarcam' }
        };
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
            
            throw error;
        }
    }

    async getServiceStatus(serviceName) {
        try {
            const command = `docker ps --filter "name=${serviceName}" --format "table {{.Names}}\t{{.Status}}"`;
            const result = await this.executeDockerCommand(command);
            
            console.log(`Status check output for ${serviceName}:`, result.stdout);
            
            const lines = result.stdout.trim().split('\n');
            
            if (lines.length <= 1) {
                console.log(`No running container found for ${serviceName}`);
                return { running: false, status: 'Stopped' };
            }
            
            const statusLine = lines[1];
            console.log(`Status line for ${serviceName}:`, statusLine);
            
            const isRunning = statusLine.includes(`${serviceName}`) && 
                             !statusLine.includes('Exited') && 
                             !statusLine.includes('Created') &&
                             statusLine.includes('Up');
            
            console.log(`Container ${serviceName} running:`, isRunning);
            
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
        
        for (const serviceName of Object.keys(this.onvifServices)) {
            statuses[serviceName] = await this.getServiceStatus(serviceName);
        }
        
        return statuses;
    }

    async startService(serviceName) {
        try {
            console.log(`Starting ONVIF service: ${serviceName}`);
            const command = `docker start ${serviceName}`;
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
            console.log(`Stopping ONVIF service: ${serviceName}`);
            const command = `docker stop ${serviceName}`;
            const result = await this.executeDockerCommand(command);
            
            console.log(`Stop output: ${result.stdout}`);
            
            if (result.stdout && result.stdout.trim() === serviceName) {
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

    getCurrentONVIFPorts() {
        const ports = {};
        for (const [serviceName, config] of Object.entries(this.onvifServices)) {
            ports[serviceName] = config.port;
        }
        return ports;
    }

    getServiceByPort(port) {
        for (const [serviceName, config] of Object.entries(this.onvifServices)) {
            if (config.port === parseInt(port)) {
                return serviceName;
            }
        }
        return null;
    }

    getServiceByBrand(brand) {
        for (const [serviceName, config] of Object.entries(this.onvifServices)) {
            if (config.brand === brand) {
                return serviceName;
            }
        }
        return null;
    }

    getServicePort(serviceName) {
        return this.onvifServices[serviceName]?.port || null;
    }

    getCurrentPortsForFrontend() {
        const ports = [];
        for (const [serviceName, config] of Object.entries(this.onvifServices)) {
            ports.push({
                serviceName: serviceName,
                port: config.port,
                brand: config.brand
            });
        }
        return ports;
    }
}

module.exports = new ONVIFManagementService(); 