#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class CameraConfig {
    constructor(brand, webPort, rtspPort, onvifPort, supportsSsh, supportsOnvif, supportsRtsp) {
        this.brand = brand;
        this.webPort = webPort;
        this.rtspPort = rtspPort;
        this.onvifPort = onvifPort;
        this.supportsSsh = supportsSsh;
        this.supportsOnvif = supportsOnvif;
        this.supportsRtsp = supportsRtsp;
    }
}

class ServiceStatus {
    constructor(name, status, ports, uptime, memory, cpu) {
        this.name = name;
        this.status = status;
        this.ports = ports;
        this.uptime = uptime;
        this.memory = memory;
        this.cpu = cpu;
    }
}

class SweetCamDockerManager {
    constructor() {
        this.composeFile = "docker-compose.yml";
        this.envFile = ".env";
        this.cameraConfigs = this.loadCameraConfigs();
    }

    loadCameraConfigs() {
        return {
            'axis': new CameraConfig('axis', 10000, 8556, 3704, true, true, true),
            'dahua': new CameraConfig('dahua', 37777, 8555, 3703, true, true, true),
            'hikvision': new CameraConfig('hikvision', 80, 8554, 3702, true, true, true),
            'mobotix': new CameraConfig('mobotix', 443, 8558, 3706, true, true, true),
            'reolink': new CameraConfig('reolink', 8081, 8557, 3705, false, true, true),
            'vstarcam': new CameraConfig('vstarcam', 81, 8559, 3707, false, true, true)
        };
    }

    getServiceNames(brand, config) {
        const services = [];
        
        // Add the brand-specific web service
        services.push(`${brand}_service`);
        
        if (config.supportsOnvif) {
            if (brand === 'hikvision') {
                services.push('onvif_service'); // Generic ONVIF service
            } else {
                services.push(`onvif_${brand}_service`);
            }
        }
        
        if (config.supportsRtsp) {
            if (brand === 'hikvision') {
                services.push('rtsp_hikvision');
            } else if (brand === 'dahua') {
                services.push('rtsp_dahua');
            } else if (brand === 'axis') {
                services.push('rtsp_axis');
            } else if (brand === 'reolink') {
                services.push('rtsp_reolink');
            } else if (brand === 'mobotix') {
                services.push('rtsp_mobotix');
            } else if (brand === 'vstarcam') {
                services.push('rtsp_vstarcam');
            }
        }
        
        return services;
    }

    showBanner() {
        const banner = `
╔══════════════════════════════════════════════════════════════╗
║                    SweetCam Docker Manager                   ║
╚══════════════════════════════════════════════════════════════╝
        `;
        console.log(banner);
    }

    showMainMenu() {
        const menu = `
Main Menu:

1. Single Camera Setup
2. Multi-Camera Setup  
3. Standard Setup (All Services)
4. Custom Setup
5. Health Check & Monitoring
6. Service Management
0. Exit

Select an option (0-6):
        `;
        console.log(menu);
    }

    async getUserInput(prompt) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(prompt, (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }

    async getNumberInput(prompt, min, max) {
        while (true) {
            const input = await this.getUserInput(prompt);
            const num = parseInt(input);
            if (!isNaN(num) && num >= min && num <= max) {
                return num;
            }
            console.log(`\x1b[31mPlease enter a number between ${min} and ${max}\x1b[0m`);
        }
    }

    async singleCameraSetup() {
        console.log("\n\x1b[36mSingle Camera Setup\x1b[0m");
        
        const brands = Object.keys(this.cameraConfigs);
        console.log("\n\x1b[1mAvailable Camera Brands:\x1b[0m");
        
        brands.forEach((brand, index) => {
            const config = this.cameraConfigs[brand];
            const sshSupport = config.supportsSsh ? "YES" : "NO";
            const onvifSupport = config.supportsOnvif ? "YES" : "NO";
            const rtspSupport = config.supportsRtsp ? "YES" : "NO";
            console.log(`${index + 1}. ${brand.charAt(0).toUpperCase() + brand.slice(1)} - SSH: ${sshSupport} | ONVIF: ${onvifSupport} | RTSP: ${rtspSupport}`);
        });

        try {
            const choice = await this.getNumberInput("\nSelect camera brand: ", 1, brands.length);
            const selectedBrand = brands[choice - 1];
            console.log(`\n\x1b[32mSelected: ${selectedBrand.charAt(0).toUpperCase() + selectedBrand.slice(1)}\x1b[0m`);

            const servicesToDeploy = ["mysql_service"];
            const config = this.cameraConfigs[selectedBrand];
            
            if (config.supportsSsh) {
                servicesToDeploy.push("cowrie_service");
            }
            
            // Add camera-specific services using correct names
            const cameraServices = this.getServiceNames(selectedBrand, config);
            servicesToDeploy.push(...cameraServices);

            await this.deployServices(servicesToDeploy, `Single ${selectedBrand} Camera Setup`);
            
        } catch (error) {
            console.log(`\x1b[31mERROR: ${error.message}\x1b[0m`);
        }
    }

    async multiCameraSetup() {
        console.log("\n\x1b[36mMulti-Camera Setup\x1b[0m");
        
        const brands = Object.keys(this.cameraConfigs);
        console.log("\n\x1b[1mAvailable Camera Brands:\x1b[0m");
        brands.forEach((brand, index) => {
            console.log(`${index + 1}. ${brand.charAt(0).toUpperCase() + brand.slice(1)}`);
        });

        const selectedBrands = [];
        console.log("\n\x1b[1mSelect cameras (enter numbers separated by commas):\x1b[0m");
        
        try {
            const input = await this.getUserInput("Enter selection: ");
            const choices = input.split(',').map(s => s.trim());
            
            choices.forEach(choice => {
                const num = parseInt(choice);
                if (!isNaN(num) && num >= 1 && num <= brands.length) {
                    selectedBrands.push(brands[num - 1]);
                }
            });

            if (selectedBrands.length === 0) {
                console.log("\x1b[31mNo valid cameras selected\x1b[0m");
                return;
            }

            console.log(`\n\x1b[32mSelected cameras: ${selectedBrands.join(', ')}\x1b[0m`);

            const servicesToDeploy = ["mysql_service"];
            
            const hasSshSupport = selectedBrands.some(brand => this.cameraConfigs[brand].supportsSsh);
            if (hasSshSupport) {
                servicesToDeploy.push("cowrie_service");
            }
            
            selectedBrands.forEach(brand => {
                const config = this.cameraConfigs[brand];
                const cameraServices = this.getServiceNames(brand, config);
                servicesToDeploy.push(...cameraServices);
            });

            await this.deployServices(servicesToDeploy, `Multi-Camera Setup (${selectedBrands.length} cameras)`);
            
        } catch (error) {
            console.log(`\x1b[31mERROR: ${error.message}\x1b[0m`);
        }
    }

    async standardSetup() {
        console.log("\n\x1b[36mStandard Setup - All Services\x1b[0m");
        
        const servicesToDeploy = [
            "mysql_service", "web_service", "cowrie_service", "grafana"
        ];
        
        Object.keys(this.cameraConfigs).forEach(brand => {
            const config = this.cameraConfigs[brand];
            const cameraServices = this.getServiceNames(brand, config);
            servicesToDeploy.push(...cameraServices);
        });

        await this.deployServices(servicesToDeploy, "Standard Setup (All Services)");
    }

    async customSetup() {
        console.log("\n\x1b[36mCustom Setup\x1b[0m");
        
        const allServices = [
            "mysql_service", "web_service", "cowrie_service", "grafana"
        ];
        
        // Add camera-specific services with correct names
        Object.keys(this.cameraConfigs).forEach(brand => {
            const config = this.cameraConfigs[brand];
            const cameraServices = this.getServiceNames(brand, config);
            allServices.push(...cameraServices);
        });

        console.log("\n\x1b[1mAvailable Services:\x1b[0m");
        allServices.forEach((service, index) => {
            console.log(`${index + 1}. ${service}`);
        });

        const selectedServices = [];
        console.log("\n\x1b[1mSelect services (enter numbers separated by commas):\x1b[0m");
        
        try {
            const input = await this.getUserInput("Enter selection: ");
            const choices = input.split(',').map(s => s.trim());
            
            choices.forEach(choice => {
                const num = parseInt(choice);
                if (!isNaN(num) && num >= 1 && num <= allServices.length) {
                    selectedServices.push(allServices[num - 1]);
                }
            });

            if (selectedServices.length === 0) {
                console.log("\x1b[31mNo valid services selected\x1b[0m");
                return;
            }

            console.log(`\n\x1b[32mSelected services: ${selectedServices.join(', ')}\x1b[0m`);
            await this.deployServices(selectedServices, "Custom Setup");
            
        } catch (error) {
            console.log(`\x1b[31mERROR: ${error.message}\x1b[0m`);
        }
    }

    async deployServices(services, setupName) {
        console.log(`\n\x1b[32m\x1b[1mDeploying ${setupName}...\x1b[0m`);
        
        for (let i = 0; i < services.length; i++) {
            const service = services[i];
            const progress = Math.round(((i + 1) / services.length) * 100);
            process.stdout.write(`\rProgress: [${'='.repeat(Math.floor(progress/2))}${' '.repeat(50-Math.floor(progress/2))}] ${progress}% - ${service}`);
            
            try {
                execSync(`docker compose -f ${this.composeFile} up -d ${service}`, { stdio: 'pipe' });
            } catch (error) {
                console.log(`\n\x1b[31mERROR Failed to start ${service}: ${error.message}\x1b[0m`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`\n\x1b[32m\x1b[1mSUCCESS: ${setupName} deployment completed!\x1b[0m`);
        
        const showStatus = await this.getUserInput("\nShow service status? (y/n): ");
        if (showStatus.toLowerCase() === 'y' || showStatus.toLowerCase() === 'yes') {
            await this.healthCheck();
        }
    }

    async healthCheck() {
        console.log("\n\x1b[36mHealth Check & Monitoring\x1b[0m");
        
        try {
            const containersOutput = execSync(`docker compose -f ${this.composeFile} ps`, { encoding: 'utf8' });
            
            if (containersOutput.trim()) {
                console.log("\nService Health Status:");
                console.log("=".repeat(80));
                console.log(containersOutput);
                
                const lines = containersOutput.split('\n').filter(line => line.trim() !== '');
                const headerLine = lines[0]; // First line is the header
                const serviceLines = lines.slice(1); // Skip header
                const running = serviceLines.filter(line => line.includes('Up')).length;
                const total = serviceLines.length;
                
                console.log(`\n\x1b[1mSummary:\x1b[0m ${running}/${total} services running`);
                
                if (running < total) {
                    console.log("\x1b[33mSome services are not running. Check logs for details.\x1b[0m");
                } else if (running === total) {
                    console.log("\x1b[32mAll services are running successfully!\x1b[0m");
                }
            } else {
                console.log("\x1b[33mNo containers running\x1b[0m");
            }
            
        } catch (error) {
            console.log(`\x1b[31mERROR Failed to get container information: ${error.message}\x1b[0m`);
        }
    }

    async serviceManagement() {
        console.log("\n\x1b[36mService Management\x1b[0m");
        
        const menu = `
1. Start Service
2. Stop Service  
3. Restart Service
4. Service Logs
5. Remove Service
6. Back to Main Menu

Select an option (1-6):
        `;
        
        while (true) {
            console.log(menu);
            const choice = await this.getUserInput("Select option: ");
            
            switch (choice) {
                case "1":
                    await this.startService();
                    break;
                case "2":
                    await this.stopService();
                    break;
                case "3":
                    await this.restartService();
                    break;
                case "4":
                    await this.showServiceLogs();
                    break;
                case "5":
                    await this.removeService();
                    break;
                case "6":
                    return;
                default:
                    console.log("\x1b[31mInvalid option. Please select 1-6.\x1b[0m");
            }
        }
    }

    async startService() {
        const service = await this.getUserInput("Enter service name to start: ");
        try {
            execSync(`docker compose -f ${this.composeFile} up -d ${service}`, { stdio: 'pipe' });
            console.log(`\x1b[32mSUCCESS ${service} started successfully\x1b[0m`);
        } catch (error) {
            console.log(`\x1b[31mERROR Failed to start ${service}: ${error.message}\x1b[0m`);
        }
    }

    async stopService() {
        const service = await this.getUserInput("Enter service name to stop: ");
        try {
            execSync(`docker compose -f ${this.composeFile} stop ${service}`, { stdio: 'pipe' });
            console.log(`\x1b[32mSUCCESS ${service} stopped successfully\x1b[0m`);
        } catch (error) {
            console.log(`\x1b[31mERROR Failed to stop ${service}: ${error.message}\x1b[0m`);
        }
    }

    async restartService() {
        const service = await this.getUserInput("Enter service name to restart: ");
        try {
            execSync(`docker compose -f ${this.composeFile} restart ${service}`, { stdio: 'pipe' });
            console.log(`\x1b[32mSUCCESS ${service} restarted successfully\x1b[0m`);
        } catch (error) {
            console.log(`\x1b[31mERROR Failed to restart ${service}: ${error.message}\x1b[0m`);
        }
    }

    async showServiceLogs() {
        const service = await this.getUserInput("Enter service name to view logs: ");
        
        let lines;
        while (true) {
            try {
                const input = await this.getUserInput("Number of log lines to show (max 100): ");
                lines = parseInt(input);
                if (!isNaN(lines) && lines >= 1 && lines <= 100) {
                    break;
                } else {
                    console.log("\x1b[31mPlease enter a number between 1 and 100\x1b[0m");
                }
            } catch (error) {
                console.log("\x1b[31mPlease enter a valid number\x1b[0m");
            }
        }
        
        try {
            const logs = execSync(`docker compose -f ${this.composeFile} logs --tail ${lines} ${service}`, { encoding: 'utf8' });
            
            if (logs.trim()) {
                console.log(`\n\x1b[1mLogs for ${service}:\x1b[0m`);
                console.log("=".repeat(60));
                console.log(logs);
                console.log("=".repeat(60));
            } else {
                console.log(`\x1b[33mNo logs available for ${service}\x1b[0m`);
            }
            
        } catch (error) {
            console.log(`\x1b[31mERROR Failed to get logs for ${service}: ${error.message}\x1b[0m`);
        }
    }

    async removeService() {
        const service = await this.getUserInput("Enter service name to remove: ");
        const confirm = await this.getUserInput(`Are you sure you want to remove ${service}? This will stop and remove the container. (y/n): `);
        
        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
            try {
                execSync(`docker compose -f ${this.composeFile} rm -f ${service}`, { stdio: 'pipe' });
                console.log(`\x1b[32mSUCCESS ${service} removed successfully\x1b[0m`);
            } catch (error) {
                console.log(`\x1b[31mERROR Failed to remove ${service}: ${error.message}\x1b[0m`);
            }
        }
    }



    async run() {
        this.showBanner();
        
        while (true) {
            try {
                this.showMainMenu();
                const choice = await this.getUserInput("\nSelect option: ");
                
                switch (choice) {
                    case "0":
                        console.log("\n\x1b[32m\x1b[1mThank you for using SweetCam Docker Manager!\x1b[0m");
                        return;
                    case "1":
                        await this.singleCameraSetup();
                        break;
                    case "2":
                        await this.multiCameraSetup();
                        break;
                    case "3":
                        await this.standardSetup();
                        break;
                    case "4":
                        await this.customSetup();
                        break;
                    case "5":
                        await this.healthCheck();
                        break;
                    case "6":
                        await this.serviceManagement();
                        break;
                    default:
                        console.log("\x1b[31mInvalid option. Please select 0-6.\x1b[0m");
                }
                
                if (choice !== "0") {
                    await this.getUserInput("\nPress Enter to continue...");
                }
                
            } catch (error) {
                console.log(`\n\x1b[31mAn error occurred: ${error.message}\x1b[0m`);
                await this.getUserInput("\nPress Enter to continue...");
            }
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    try {
        const manager = new SweetCamDockerManager();
        
        if (args.includes('--health-check')) {
            await manager.healthCheck();
        } else {
            await manager.run();
        }
        
    } catch (error) {
        console.log(`\n\x1b[31mFatal error: ${error.message}\x1b[0m`);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SweetCamDockerManager; 