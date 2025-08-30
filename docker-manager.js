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
7. Install Docker
0. Exit

Select an option (0-7):
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

    async installDocker() {
        console.log("\n\x1b[36mDocker Installation & Setup\x1b[0m");
        
        try {
            // Check if Docker is already installed
            try {
                execSync('docker --version', { stdio: 'pipe' });
                console.log("\x1b[32m✓ Docker is already installed\x1b[0m");
                
                const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
                console.log(`\x1b[1mDocker Version: ${dockerVersion}\x1b[0m`);
                
                // Check if Docker daemon is running
                try {
                    execSync('docker info', { stdio: 'pipe' });
                    console.log("\x1b[32m✓ Docker daemon is running\x1b[0m");
                    
                    // Check Docker Compose
                    try {
                        execSync('docker compose version', { stdio: 'pipe' });
                        console.log("\x1b[32m✓ Docker Compose is available\x1b[0m");
                        
                        const composeVersion = execSync('docker compose version', { encoding: 'utf8' }).trim();
                        console.log(`\x1b[1mDocker Compose Version: ${composeVersion}\x1b[0m`);
                        
                        console.log("\n\x1b[32m\x1b[1mDocker is fully configured and ready to use!\x1b[0m");
                        return;
                        
                    } catch (error) {
                        console.log("\x1b[33m⚠ Docker Compose not found. Installing...\x1b[0m");
                        await this.installDockerCompose();
                    }
                    
                } catch (error) {
                    console.log("\x1b[33m⚠ Docker daemon is not running. Starting...\x1b[0m");
                    await this.startDockerDaemon();
                }
                
            } catch (error) {
                console.log("\x1b[33m⚠ Docker not found. Installing...\x1b[0m");
                await this.installDockerEngine();
            }
            
        } catch (error) {
            console.log(`\x1b[31mERROR: ${error.message}\x1b[0m`);
        }
    }

    async installDockerEngine() {
        console.log("\n\x1b[36mInstalling Docker Engine...\x1b[0m");
        
        try {
            // Detect OS
            const platform = process.platform;
            const arch = process.arch;
            
            console.log(`\x1b[1mDetected: ${platform} (${arch})\x1b[0m`);
            
            if (platform === 'linux') {
                await this.installDockerLinux();
            } else if (platform === 'darwin') {
                await this.installDockerMac();
            } else if (platform === 'win32') {
                await this.installDockerWindows();
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }
            
        } catch (error) {
            console.log(`\x1b[31mERROR Installing Docker Engine: ${error.message}\x1b[0m`);
            console.log("\x1b[33mPlease install Docker manually from: https://docs.docker.com/get-docker/\x1b[0m");
        }
    }

    async installDockerLinux() {
        console.log("\n\x1b[36mInstalling Docker on Linux...\x1b[0m");
        
        try {
            // Check if running as root
            if (process.getuid && process.getuid() !== 0) {
                console.log("\x1b[33m⚠ This operation requires root privileges\x1b[0m");
                console.log("\x1b[1mPlease run with sudo or as root user\x1b[0m");
                return;
            }
            
            // Update package list
            console.log("Updating package list...");
            execSync('apt-get update', { stdio: 'pipe' });
            
            // Install prerequisites
            console.log("Installing prerequisites...");
            execSync('apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release', { stdio: 'pipe' });
            
            // Add Docker's official GPG key
            console.log("Adding Docker GPG key...");
            execSync('curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg', { stdio: 'pipe' });
            
            // Add Docker repository
            console.log("Adding Docker repository...");
            const release = execSync('lsb_release -cs', { encoding: 'utf8' }).trim();
            execSync(`echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu ${release} stable" > /etc/apt/sources.list.d/docker.list`, { stdio: 'pipe' });
            
            // Update package list again
            execSync('apt-get update', { stdio: 'pipe' });
            
            // Install Docker
            console.log("Installing Docker Engine...");
            execSync('apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin', { stdio: 'pipe' });
            
            // Start and enable Docker
            console.log("Starting Docker service...");
            execSync('systemctl start docker', { stdio: 'pipe' });
            execSync('systemctl enable docker', { stdio: 'pipe' });
            
            // Add current user to docker group
            const username = execSync('whoami', { encoding: 'utf8' }).trim();
            execSync(`usermod -aG docker ${username}`, { stdio: 'pipe' });
            
            console.log("\x1b[32m✓ Docker Engine installed successfully!\x1b[0m");
            console.log(`\x1b[1mNote: You may need to log out and back in for group changes to take effect\x1b[0m`);
            
        } catch (error) {
            throw new Error(`Linux installation failed: ${error.message}`);
        }
    }

    async installDockerMac() {
        console.log("\n\x1b[36mInstalling Docker on macOS...\x1b[0m");
        
        try {
            // Check if Homebrew is installed
            try {
                execSync('brew --version', { stdio: 'pipe' });
            } catch (error) {
                console.log("\x1b[33m⚠ Homebrew not found. Installing Homebrew first...\x1b[0m");
                execSync('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', { stdio: 'pipe' });
            }
            
            // Install Docker Desktop
            console.log("Installing Docker Desktop...");
            execSync('brew install --cask docker', { stdio: 'pipe' });
            
            console.log("\x1b[32m✓ Docker Desktop installed successfully!\x1b[0m");
            console.log("\x1b[1mPlease start Docker Desktop from Applications folder\x1b[0m");
            
        } catch (error) {
            throw new Error(`macOS installation failed: ${error.message}`);
        }
    }

    async installDockerWindows() {
        console.log("\n\x1b[36mInstalling Docker on Windows...\x1b[0m");
        
        try {
            // Check if running on Windows 10/11
            const osRelease = execSync('ver', { encoding: 'utf8' }).trim();
            if (!osRelease.includes('10') && !osRelease.includes('11')) {
                throw new Error('Docker Desktop requires Windows 10 or later');
            }
            
            // Check if WSL2 is available
            try {
                execSync('wsl --version', { stdio: 'pipe' });
            } catch (error) {
                console.log("\x1b[33m⚠ WSL2 not found. Installing WSL2...\x1b[0m");
                execSync('wsl --install', { stdio: 'pipe' });
            }
            
            // Download Docker Desktop installer
            console.log("Downloading Docker Desktop...");
            execSync('curl -L -o DockerDesktopInstaller.exe "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"', { stdio: 'pipe' });
            
            // Run installer
            console.log("Running Docker Desktop installer...");
            execSync('start /wait DockerDesktopInstaller.exe install --quiet', { stdio: 'pipe' });
            
            // Clean up installer
            execSync('del DockerDesktopInstaller.exe', { stdio: 'pipe' });
            
            console.log("\x1b[32m✓ Docker Desktop installed successfully!\x1b[0m");
            console.log("\x1b[1mPlease restart your computer and start Docker Desktop\x1b[0m");
            
        } catch (error) {
            throw new Error(`Windows installation failed: ${error.message}`);
        }
    }

    async installDockerCompose() {
        console.log("\n\x1b[36mInstalling Docker Compose...\x1b[0m");
        
        try {
            const platform = process.platform;
            
            if (platform === 'linux') {
                // Install Docker Compose plugin
                console.log("Installing Docker Compose plugin...");
                execSync('apt-get install -y docker-compose-plugin', { stdio: 'pipe' });
                
                console.log("\x1b[32m✓ Docker Compose plugin installed successfully!\x1b[0m");
                
            } else if (platform === 'darwin' || platform === 'win32') {
                // Docker Compose is included with Docker Desktop
                console.log("\x1b[32m✓ Docker Compose is included with Docker Desktop\x1b[0m");
            }
            
        } catch (error) {
            throw new Error(`Docker Compose installation failed: ${error.message}`);
        }
    }

    async startDockerDaemon() {
        console.log("\n\x1b[36mStarting Docker Daemon...\x1b[0m");
        
        try {
            const platform = process.platform;
            
            if (platform === 'linux') {
                console.log("Starting Docker service...");
                execSync('systemctl start docker', { stdio: 'pipe' });
                execSync('systemctl enable docker', { stdio: 'pipe' });
                
                console.log("\x1b[32m✓ Docker daemon started successfully!\x1b[0m");
                
            } else if (platform === 'darwin') {
                console.log("\x1b[33m⚠ Please start Docker Desktop from Applications folder\x1b[0m");
                
            } else if (platform === 'win32') {
                console.log("\x1b[33m⚠ Please start Docker Desktop from Start menu\x1b[0m");
            }
            
        } catch (error) {
            throw new Error(`Failed to start Docker daemon: ${error.message}`);
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
                    case "7":
                        await this.installDocker();
                        break;
                    default:
                        console.log("\x1b[31mInvalid option. Please select 0-7.\x1b[0m");
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