const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

const SERVICES = {
    web: {
        name: 'Web Services',
        logPattern: 'webservices/*.log',
        eventTypes: ['login_attempt', 'auth_failure', 'rtsp_management', 'rtsp_service_toggle', 'service_event']
    },
    rtsp: {
        name: 'RTSP Services',
        logPattern: 'rtspservices/*.log',
        eventTypes: ['rtsp_method', 'connection_event', 'service_event', 'auth_attempt']
    },
    onvif: {
        name: 'ONVIF Services',
        logPattern: 'onvifservices/*.log',
        eventTypes: ['soap_request', 'connection_event', 'ws_discovery', 'device_info_request', 'service_event']
    }
};

let config = {
    logsDir: './logs',
    service: null,
    date: null,
    eventTypes: [],
    logLevels: [],
    startDate: null,
    endDate: null,
    ipAddresses: [],
    brands: [],
    limit: null,
    showPasswords: false,
    analyze: false,
    search: null,
    caseSensitive: false,
    deleteOld: null,
    deleteByDate: null,
    execute: false,
    dryRun: true,
    docker: false,
    restartServices: false
};

function parseArgs() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];
        
        switch (arg) {
            case '--service':
                config.service = nextArg;
                i++;
                break;
            case '--date':
                config.date = nextArg;
                i++;
                break;
            case '--event-types':
                //handle space separated values by collecting all arguments until next option
                const eventTypes = [];
                let j = i + 1;
                while (j < args.length && !args[j].startsWith('--')) {
                    eventTypes.push(args[j]);
                    j++;
                }
                config.eventTypes = eventTypes;
                i = j - 1;
                break;
            case '--log-levels':
                //handle space separated values
                const logLevels = [];
                let k = i + 1;
                while (k < args.length && !args[k].startsWith('--')) {
                    logLevels.push(args[k]);
                    k++;
                }
                config.logLevels = logLevels;
                i = k - 1;
                break;
            case '--start-date':
                config.startDate = nextArg;
                i++;
                break;
            case '--end-date':
                config.endDate = nextArg;
                i++;
                break;
            case '--ip-addresses':
                const ipAddresses = [];
                let l = i + 1;
                while (l < args.length && !args[l].startsWith('--')) {
                    ipAddresses.push(args[l]);
                    l++;
                }
                config.ipAddresses = ipAddresses;
                i = l - 1;
                break;
            case '--brands':
                const brands = [];
                let m = i + 1;
                while (m < args.length && !args[m].startsWith('--')) {
                    brands.push(args[m]);
                    m++;
                }
                config.brands = brands;
                i = m - 1;
                break;
            case '--limit':
                config.limit = parseInt(nextArg);
                i++;
                break;
            case '--show-passwords':
                config.showPasswords = true;
                break;
            case '--analyze':
                config.analyze = true;
                break;
            case '--search':
                config.search = nextArg;
                i++;
                break;
            case '--case-sensitive':
                config.caseSensitive = true;
                break;
            case '--delete-old':
                config.deleteOld = parseInt(nextArg);
                i++;
                break;
            case '--delete-by-date':
                config.deleteByDate = nextArg;
                i++;
                break;
            case '--execute':
                config.execute = true;
                config.dryRun = false;
                break;
            case '--restart-services':
                config.restartServices = true;
                break;
            case '--logs-dir':
                config.logsDir = nextArg;
                i++;
                break;
            case '--docker':
                config.docker = true;
                break;
            case '-h':
            case '--help':
                showUsage();
                process.exit(0);
                break;
            default:
                console.log(`${colors.red}Error: Unknown option ${arg}${colors.reset}`);
                showUsage();
                process.exit(1);
        }
    }
}

function showUsage() {
    console.log(`
Usage: node log_manager.js [OPTIONS]

SweetCam Honeypot Log Manager - JavaScript Version

OPTIONS:
    --service SERVICE          Specific service to analyze (web, rtsp, onvif)
    --date DATE               Specific date (YYYY-MM-DD)
    --event-types TYPES       Filter by event types (space-separated)
    --log-levels LEVELS       Filter by log levels (info, error, warn, debug)
    --start-date DATE         Start date for range (YYYY-MM-DD)
    --end-date DATE           End date for range (YYYY-MM-DD)
    --ip-addresses IPS        Filter by IP addresses (space-separated)
    --brands BRANDS           Filter by brands (space-separated)
    --limit N                 Limit number of displayed entries
    --show-passwords          Show passwords in output
    --analyze                 Perform log analysis
    --search TEXT             Search for specific text in logs
    --case-sensitive          Case sensitive search
    --delete-old DAYS         Delete logs and JSON files older than N days
    --delete-by-date DATE     Delete logs and JSON files from specific date (YYYY-MM-DD)
    --execute                 Execute delete operations (default is dry run)
    --restart-services        Restart services after log deletion to fix file handles
    --logs-dir DIR            Logs directory path (default: ./logs)
    --docker                  Read logs from Docker containers (default: read from files)
    -h, --help               Show this help message

EXAMPLES:
    node log_manager.js --service web --limit 10
    node log_manager.js --event-types auth_failure --show-passwords
    node log_manager.js --service onvif --brands axis dahua --analyze
    node log_manager.js --search "admin" --service web
    node log_manager.js --delete-old 7 --execute
    node log_manager.js --delete-old 7 --execute --restart-services
    node log_manager.js --delete-old 0 --execute  # Delete today's logs and JSON files
    node log_manager.js --delete-by-date 2025-08-30 --execute  # Delete files from specific date
`);
}

function getLogFiles(service = null, date = null) {
    const files = [];
    
    if (service && !SERVICES[service]) {
        console.log(`${colors.red}[ERROR] Unknown service: ${service}${colors.reset}`);
        return files;
    }
    
    const servicesToCheck = service ? [service] : Object.keys(SERVICES);
    
    for (const serviceName of servicesToCheck) {
        const serviceDirMap = {
            'web': 'webservices',
            'rtsp': 'rtspservices', 
            'onvif': 'onvifservices'
        };
        
        const serviceDir = serviceDirMap[serviceName];
        const servicePath = path.join(config.logsDir, serviceDir);
        
        if (!fs.existsSync(servicePath)) {
            continue;
        }
        
        const pattern = date ? `*-${date}.log` : '*.log';
        const globPattern = path.join(servicePath, pattern);
        
        try {
            const serviceFiles = fs.readdirSync(servicePath)
                .filter(file => file.endsWith('.log') || file.endsWith('.json'))
                .filter(file => !date || file.includes(`-${date}.log`) || file.includes(`-${date}.json`))
                .map(file => path.join(servicePath, file));
            
            files.push(...serviceFiles);
        } catch (error) {
            console.log(`${colors.yellow}[WARN] Error reading ${servicePath}: ${error.message}${colors.reset}`);
        }
    }
    
    return files.sort();
}

function parseLogLine(line) {
    try {
        const data = JSON.parse(line.trim());
        return {
            timestamp: data.timestamp || 'Unknown',
            level: data.level || 'info',
            message: data.message || '',
            service: data.service || 'unknown',
            eventType: data.event_type || 'unknown',
            ipAddress: data.ip_address || 'Unknown',
            userAgent: data.user_agent || '',
            brand: data.brand || 'Unknown',
            port: data.port || 'Unknown',
            username: data.username || 'Unknown',
            password: data.password || 'Unknown',
            rawData: data
        };
    } catch (error) {
        return null;
    }
}

function readLogs(service = null, date = null) {
    const logFiles = getLogFiles(service, date);
    const entries = [];
    
    for (const file of logFiles) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                const entry = parseLogLine(line);
                if (entry) {
                    entries.push(entry);
                }
            }
        } catch (error) {
            console.log(`${colors.yellow}[WARN] Error reading ${file}: ${error.message}${colors.reset}`);
        }
    }
    
    return entries;
}

function filterLogs(entries) {
    return entries.filter(entry => {
        //filter by event types
        if (config.eventTypes.length > 0 && !config.eventTypes.includes(entry.eventType)) {
            return false;
        }
        //filter by log levels
        if (config.logLevels.length > 0 && !config.logLevels.includes(entry.level)) {
            return false;
        }
        //filter by date range
        if (config.startDate || config.endDate) {
            if (!isInDateRange(entry.timestamp, config.startDate, config.endDate)) {
                return false;
            }
        }
        //filter by IP addresses
        if (config.ipAddresses.length > 0 && !config.ipAddresses.includes(entry.ipAddress)) {
            return false;
        }
        //filter by brands
        if (config.brands.length > 0 && !config.brands.includes(entry.brand)) {
            return false;
        }
        
        //ff --show-passwords is enabled only show entries that have password data
        if (config.showPasswords) {
            //for password-related events, show them if they have any password-related data
            const passwordEvents = ['auth_failure', 'login_attempt'];
            const isPasswordEvent = passwordEvents.includes(entry.eventType);            
            const hasPasswordData = entry.password && 
                                   entry.password !== 'Unknown' && 
                                   entry.password !== 'null' && 
                                   entry.password !== '' &&
                                   entry.password !== null;            
            if (!isPasswordEvent && !hasPasswordData) {
                return false;
            }
        }        
        return true;
    });
}

function isInDateRange(timestamp, startDate, endDate) {
    if (!timestamp || timestamp === 'Unknown') {
        return false;
    }   
    try {
        const logDate = timestamp.split(' ')[0];
        
        if (startDate && logDate < startDate) {
            return false;
        }        
        if (endDate && logDate > endDate) {
            return false;
        }
        return true;
    } catch (error) {
        return false;
    }
}

function displayLogs(entries) {
    if (entries.length === 0) {
        console.log(`${colors.yellow}[EMPTY] No log entries found matching the criteria.${colors.reset}`);
        return;
    }
    
    //apply limit
    if (config.limit && entries.length > config.limit) {
        entries = entries.slice(-config.limit);
    }
    
    console.log(`\n${colors.blue}[INFO] Found ${entries.length} log entries:${colors.reset}`);
    console.log('==================================================================================');
    entries.forEach((entry, index) => {
        const i = index + 1;
        const timestamp = entry.timestamp || 'Unknown';
        const level = (entry.level || 'info').toUpperCase();
        const eventType = entry.eventType || 'unknown';
        const ip = entry.ipAddress || 'Unknown';
        const brand = entry.brand || 'Unknown';
        const port = String(entry.port || 'Unknown');
        const message = (entry.message || '').substring(0, 100);
        
        //color coding for log levels
        const levelColors = {
            'ERROR': '[ERROR]',
            'WARN': '[WARN]',
            'INFO': '[INFO]',
            'DEBUG': '[DEBUG]'
        };
        const levelColor = levelColors[level] || '[INFO]';
        
        console.log(`${i.toString().padStart(3)}. ${levelColor} ${timestamp} | ${level.padEnd(5)} | ${eventType.padEnd(20)} | ${ip.padEnd(15)} | ${brand.padEnd(10)} | ${port.padEnd(5)}`);
        console.log(`     [MSG] ${message}`);
        
        if ((eventType === 'login_attempt' || eventType === 'auth_failure') && config.showPasswords) {
            console.log(`     [USER] User: ${entry.username || 'Unknown'} | Password: ${entry.password || 'Unknown'}`);
        }
        
        console.log('');
    });
}

function analyzeLogs(entries) {
    if (entries.length === 0) {
        console.log(`${colors.yellow}[EMPTY] No log entries to analyze.${colors.reset}`);
        return;
    }    
    console.log(`\n${colors.cyan}[ANALYSIS] Log Analysis:${colors.reset}`);
    console.log('==================================================');
    
    //event type distribution
    const eventCounts = {};
    const ipCounts = {};
    const brandCounts = {};
    
    const validBrands = ['hikvision', 'dahua', 'axis', 'reolink', 'vstarcam', 'mobotix'];
    
    entries.forEach(entry => {
        eventCounts[entry.eventType] = (eventCounts[entry.eventType] || 0) + 1;
        
        if (entry.ipAddress && entry.ipAddress !== 'Unknown') {
            ipCounts[entry.ipAddress] = (ipCounts[entry.ipAddress] || 0) + 1;
        }        
        if (entry.brand && entry.brand !== 'Unknown' && entry.brand !== 'null') {
            const brand = entry.brand.toLowerCase();            
            if (!isNaN(brand) || brand === 'auto' || brand === 'admin') {
                return;
            }
            if (validBrands.includes(brand)) {
                brandCounts[brand] = (brandCounts[brand] || 0) + 1;
            }
        }
    });
    
    console.log(`\n${colors.magenta}[EVENTS] Event Type Distribution:${colors.reset}`);
    Object.entries(eventCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([eventType, count]) => {
            console.log(`   ${eventType.padEnd(25)}: ${count.toString().padStart(4)}`);
        });
    
    if (Object.keys(ipCounts).length > 0) {
        console.log(`\n${colors.green}[IPS] Top IP Addresses:${colors.reset}`);
        Object.entries(ipCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .forEach(([ip, count]) => {
                console.log(`   ${ip.padEnd(15)}: ${count.toString().padStart(4)} requests`);
            });
    }    
    if (Object.keys(brandCounts).length > 0) {
        console.log(`\n${colors.yellow}[BRANDS] Brand Distribution:${colors.reset}`);
        Object.entries(brandCounts)
            .sort(([,a], [,b]) => b - a)
            .forEach(([brand, count]) => {
                console.log(`   ${brand.padEnd(15)}: ${count.toString().padStart(4)} events`);
            });
    } else {
        console.log(`\n${colors.yellow}[BRANDS] No valid camera brands found in logs${colors.reset}`);
    }
}

function searchLogs(query, service = null) {
    const entries = readLogs(service, null);
    const matchingEntries = [];
    
    const searchQuery = config.caseSensitive ? query : query.toLowerCase();
    
    entries.forEach(entry => {
        const searchableText = `${entry.message} ${JSON.stringify(entry.rawData)}`;
        const textToSearch = config.caseSensitive ? searchableText : searchableText.toLowerCase();
        
        if (textToSearch.includes(searchQuery)) {
            matchingEntries.push(entry);
        }
    });
    
    console.log(`\n${colors.blue}[SEARCH] Found ${matchingEntries.length} entries matching '${query}':${colors.reset}`);
    displayLogs(matchingEntries);
}

function deleteByDate(targetDate, service = null) {
    if (config.docker) {
        // Docker version - similar to deleteOldLogs but for specific date
        let containerMap = {};
        try {
            const runningContainers = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' }).trim().split('\n');
            
            // Map service types to running containers - check most specific first
            runningContainers.forEach(containerName => {
                if (containerName.includes('rtsp')) {
                    if (!containerMap.rtsp) containerMap.rtsp = containerName;
                } else if (containerName.includes('onvif')) {
                    if (!containerMap.onvif) containerName;
                } else if (containerName.includes('web')) {
                    if (!containerMap.web) containerMap.web = containerName;
                } else if (!containerName.includes('rtsp') && !containerName.includes('onvif') && 
                    (containerName.includes('axis') || containerName.includes('dahua') || 
                    containerName.includes('hikvision') || containerName.includes('mobotix') || 
                    containerName.includes('reolink') || containerName.includes('vstarcam'))) {
                    // These brand-specific services have web service logs mounted
                    if (!containerMap.web) containerMap.web = containerName;
                }
            });
            
            // If no containers found for a service type, use defaults
            if (!containerMap.web) containerMap.web = 'axis_service';
            if (!containerMap.rtsp) containerMap.rtsp = 'rtsp_axis_service';
            if (!containerMap.onvif) containerMap.onvif = 'onvif_axis_service';
            
        } catch (error) {
            console.log(`${colors.yellow}[WARN] Error detecting running containers, using defaults: ${error.message}${colors.reset}`);
            containerMap = {
                'web': 'axis_service',
                'rtsp': 'rtsp_axis_service',
                'onvif': 'onvif_axis_service'
            };
        }
        
        const servicesToCheck = service ? [service] : Object.keys(containerMap);
        const filesToDelete = [];
        
        for (const serviceName of servicesToCheck) {
            const containerName = containerMap[serviceName];
            if (!containerName) continue;
            
            try {
                // Define which log directories to check for each service
                const logDirectories = {
                    'web': ['webservices'],
                    'rtsp': [''],  // RTSP services mount logs directly to /app/logs
                    'onvif': ['']   // ONVIF services mount logs directly to /app/logs
                };
                
                const directoriesToCheck = logDirectories[serviceName] || ['webservices', 'rtspservices', 'onvifservices'];
                
                for (const logDir of directoriesToCheck) {
                    try {
                        // Find old log files and JSON files in specific log directory
                        const logPath = logDir ? `/app/logs/${logDir}` : '/app/logs';
                        const logResult = execSync(`docker exec ${containerName} find ${logPath} -name "*.log" -type f 2>/dev/null`, { encoding: 'utf8' });
                        const jsonResult = execSync(`docker exec ${containerName} find ${logPath} -name "*.json" -type f 2>/dev/null`, { encoding: 'utf8' });
                        const containerFiles = [...logResult.trim().split('\n'), ...jsonResult.trim().split('\n')].filter(file => file);
                        
                        for (const containerFile of containerFiles) {
                            try {
                                // Extract date from filename (handles both .log and .json files)
                                const filename = path.basename(containerFile);
                                const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
                                
                                if (dateMatch) {
                                    const fileDate = dateMatch[1];
                                    if (fileDate === targetDate) {
                                        filesToDelete.push({ container: containerName, file: containerFile });
                                    }
                                } else {
                                    // Check file modification time (for files without date patterns like audit JSON files)
                                    const stats = execSync(`docker exec ${containerName} stat -c %Y "${containerFile}"`, { encoding: 'utf8' });
                                    const mtime = new Date(parseInt(stats.trim()) * 1000);
                                    const mtimeStr = mtime.toISOString().split('T')[0];
                                    
                                    if (mtimeStr === targetDate) {
                                        filesToDelete.push({ container: containerName, file: containerFile });
                                    }
                                }
                            } catch (error) {
                                console.log(`${colors.yellow}[WARN] Error checking file ${containerFile}: ${error.message}${colors.reset}`);
                            }
                        }
                    } catch (error) {
                        // Directory might not exist, continue to next
                        continue;
                    }
                }
            } catch (error) {
                console.log(`${colors.yellow}[WARN] Error accessing container ${containerName}: ${error.message}${colors.reset}`);
            }
        }
        
        if (filesToDelete.length === 0) {
            console.log(`${colors.yellow}[EMPTY] No log and JSON files found for date: ${targetDate}${colors.reset}`);
            return;
        }
        
        console.log(`\n${colors.red}[DELETE] Found ${filesToDelete.length} log and JSON files for date: ${targetDate}${colors.reset}`);
        filesToDelete.forEach(({ container, file }) => {
            console.log(`   ${container}:${file}`);
        });
        
        if (!config.dryRun) {
            console.log(`\n${colors.red}[WARN] Deleting ${filesToDelete.length} files...${colors.reset}`);
            filesToDelete.forEach(({ container, file }) => {
                try {
                    execSync(`docker exec ${container} rm "${file}"`, { encoding: 'utf8' });
                    console.log(`   ${colors.green}[OK] Deleted: ${container}:${file}${colors.reset}`);
                } catch (error) {
                    console.log(`   ${colors.red}[ERROR] Error deleting ${container}:${file}: ${error.message}${colors.reset}`);
                }
            });
        } else {
            console.log(`\n${colors.blue}[DRY-RUN] Dry run mode - no files were deleted.${colors.reset}`);
            console.log('   Use --execute to actually delete the files.');
        }
        
        // Restart services after deletion to fix file handle issues
        if (!config.dryRun && filesToDelete.length > 0 && config.restartServices) {
            restartServicesAfterLogDeletion();
        }
    } else {
        // Local file logic
        const logFiles = getLogFiles(service, targetDate);
        const filesToDelete = [];
        
        logFiles.forEach(file => {
            try {
                //try to extract date from filename (handles both .log and .json files)
                const filename = path.basename(file);
                const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
                
                if (dateMatch) {
                    const fileDate = dateMatch[1];
                    if (fileDate === targetDate) {
                        filesToDelete.push(file);
                    }
                } else {
                    // For files without date patterns (like audit JSON files), check modification time
                    const stats = fs.statSync(file);
                    const mtime = new Date(stats.mtime);
                    const mtimeStr = mtime.toISOString().split('T')[0];
                    
                    if (mtimeStr === targetDate) {
                        filesToDelete.push(file);
                    }
                }
            } catch (error) {
                console.log(`${colors.yellow}[WARN] Error checking file ${file}: ${error.message}${colors.reset}`);
            }
        });
        
        if (filesToDelete.length === 0) {
            console.log(`${colors.yellow}[EMPTY] No log and JSON files found for date: ${targetDate}${colors.reset}`);
            return;
        }
        
        console.log(`\n${colors.red}[DELETE] Found ${filesToDelete.length} log and JSON files for date: ${targetDate}${colors.reset}`);
        filesToDelete.forEach(file => {
            console.log(`   ${file}`);
        });
        
        if (!config.dryRun) {
            console.log(`\n${colors.red}[WARN] Deleting ${filesToDelete.length} files...${colors.reset}`);
            filesToDelete.forEach(file => {
                try {
                    fs.unlinkSync(file);
                    console.log(`   ${colors.green}[OK] Deleted: ${file}${colors.reset}`);
                } catch (error) {
                    console.log(`   ${colors.red}[ERROR] Error deleting ${file}: ${error.message}${colors.reset}`);
                }
            });
        } else {
            console.log(`\n${colors.blue}[DRY-RUN] Dry run mode - no files were deleted.${colors.reset}`);
            console.log('   Use --execute to actually delete the files.');
        }
    }
}

function deleteOldLogs(days, service = null) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    if (config.docker) {
        // Dynamically detect running containers
        let containerMap = {};
        try {
            const runningContainers = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' }).trim().split('\n');
            
            // Map service types to running containers - check most specific first
            runningContainers.forEach(containerName => {
                if (containerName.includes('rtsp')) {
                    if (!containerMap.rtsp) containerMap.rtsp = containerName;
                } else if (containerName.includes('onvif')) {
                    if (!containerMap.onvif) containerMap.onvif = containerName;
                } else if (containerName.includes('web')) {
                    if (!containerMap.web) containerMap.web = containerName;
                } else if (!containerName.includes('rtsp') && !containerName.includes('onvif') && 
                    (containerName.includes('axis') || containerName.includes('dahua') || 
                    containerName.includes('hikvision') || containerName.includes('mobotix') || 
                    containerName.includes('reolink') || containerName.includes('vstarcam'))) {
                    // These brand-specific services have web service logs mounted
                    if (!containerMap.web) containerMap.web = containerName;
                }
            });
            
            // If no containers found for a service type, use defaults
            if (!containerMap.web) containerMap.web = 'axis_service';
            if (!containerMap.rtsp) containerMap.rtsp = 'rtsp_axis_service';
            if (!containerMap.onvif) containerMap.onvif = 'onvif_axis_service';
            
        } catch (error) {
            console.log(`${colors.yellow}[WARN] Error detecting running containers, using defaults: ${error.message}${colors.reset}`);
            containerMap = {
                'web': 'axis_service',
                'rtsp': 'rtsp_axis_service',
                'onvif': 'onvif_axis_service'
            };
        }
        
        const servicesToCheck = service ? [service] : Object.keys(containerMap);
        const filesToDelete = [];
        
        for (const serviceName of servicesToCheck) {
            const containerName = containerMap[serviceName];
            if (!containerName) continue;
            
            try {
                // Define which log directories to check for each service
                const logDirectories = {
                    'web': ['webservices'],
                    'rtsp': [''],  // RTSP services mount logs directly to /app/logs
                    'onvif': ['']   // ONVIF services mount logs directly to /app/logs
                };
                
                const directoriesToCheck = logDirectories[serviceName] || ['webservices', 'rtspservices', 'onvifservices'];
                
                for (const logDir of directoriesToCheck) {
                    try {
                        // Find old log files and JSON files in specific log directory
                        const logPath = logDir ? `/app/logs/${logDir}` : '/app/logs';
                        const logResult = execSync(`docker exec ${containerName} find ${logPath} -name "*.log" -type f 2>/dev/null`, { encoding: 'utf8' });
                        const jsonResult = execSync(`docker exec ${containerName} find ${logPath} -name "*.json" -type f 2>/dev/null`, { encoding: 'utf8' });
                        const containerFiles = [...logResult.trim().split('\n'), ...jsonResult.trim().split('\n')].filter(file => file);
                        
                        for (const containerFile of containerFiles) {
                            try {
                                // Extract date from filename (handles both .log and .json files)
                                const filename = path.basename(containerFile);
                                const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
                                
                                if (dateMatch) {
                                    const fileDate = dateMatch[1];
                                    if (fileDate < cutoffDateStr) {
                                        filesToDelete.push({ container: containerName, file: containerFile });
                                    }
                                } else {
                                    // Check file modification time (for files without date patterns like audit JSON files)
                                    const stats = execSync(`docker exec ${containerName} stat -c %Y "${containerFile}"`, { encoding: 'utf8' });
                                    const mtime = new Date(parseInt(stats.trim()) * 1000);
                                    const mtimeStr = mtime.toISOString().split('T')[0];
                                    
                                    if (mtimeStr < cutoffDateStr) {
                                        filesToDelete.push({ container: containerName, file: containerFile });
                                    }
                                }
                            } catch (error) {
                                console.log(`${colors.yellow}[WARN] Error checking file ${containerFile}: ${error.message}${colors.reset}`);
                            }
                        }
                    } catch (error) {
                        // Directory might not exist, continue to next
                        continue;
                    }
                }
            } catch (error) {
                console.log(`${colors.yellow}[WARN] Error accessing container ${containerName}: ${error.message}${colors.reset}`);
            }
        }
        
        if (filesToDelete.length === 0) {
            console.log(`${colors.yellow}[EMPTY] No old log files found to delete.${colors.reset}`);
            return;
        }
        
        console.log(`\n${colors.red}[DELETE] Found ${filesToDelete.length} log files older than ${days} days:${colors.reset}`);
        filesToDelete.forEach(({ container, file }) => {
            console.log(`   ${container}:${file}`);
        });
        
        if (!config.dryRun) {
            console.log(`\n${colors.red}[WARN] Deleting ${filesToDelete.length} files...${colors.reset}`);
            filesToDelete.forEach(({ container, file }) => {
                try {
                    execSync(`docker exec ${container} rm "${file}"`, { encoding: 'utf8' });
                    console.log(`   ${colors.green}[OK] Deleted: ${container}:${file}${colors.reset}`);
                } catch (error) {
                    console.log(`   ${colors.red}[ERROR] Error deleting ${container}:${file}: ${error.message}${colors.reset}`);
                }
            });
        } else {
            console.log(`\n${colors.blue}[DRY-RUN] Dry run mode - no files were deleted.${colors.reset}`);
            console.log('   Use --execute to actually delete the files.');
        }
        
        // Restart services after deletion to fix file handle issues
        if (!config.dryRun && filesToDelete.length > 0 && config.restartServices) {
            restartServicesAfterLogDeletion();
        }
    } else {
        // Original local file logic
        const logFiles = getLogFiles(service, null);
        const filesToDelete = [];
        
        logFiles.forEach(file => {
            try {
                //try to extract date from filename (handles both .log and .json files)
                const filename = path.basename(file);
                const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
                
                if (dateMatch) {
                    const fileDate = dateMatch[1];
                    if (fileDate < cutoffDateStr) {
                        filesToDelete.push(file);
                    }
                } else {
                    // For files without date patterns (like audit JSON files), check modification time
                    const stats = fs.statSync(file);
                    const mtime = new Date(stats.mtime);
                    const mtimeStr = mtime.toISOString().split('T')[0];
                    
                    if (mtimeStr < cutoffDateStr) {
                        filesToDelete.push(file);
                    }
                }
            } catch (error) {
                console.log(`${colors.yellow}[WARN] Error checking file ${file}: ${error.message}${colors.reset}`);
            }
        });
        
        if (filesToDelete.length === 0) {
            console.log(`${colors.yellow}[EMPTY] No old log files found to delete.${colors.reset}`);
            return;
        }
        
        console.log(`\n${colors.red}[DELETE] Found ${filesToDelete.length} log files older than ${days} days:${colors.reset}`);
        filesToDelete.forEach(file => {
            console.log(`   ${file}`);
        });
        
        if (!config.dryRun) {
            console.log(`\n${colors.red}[WARN] Deleting ${filesToDelete.length} files...${colors.reset}`);
            filesToDelete.forEach(file => {
                try {
                    fs.unlinkSync(file);
                    console.log(`   ${colors.green}[OK] Deleted: ${file}${colors.reset}`);
                } catch (error) {
                    console.log(`   ${colors.red}[ERROR] Error deleting ${file}: ${error.message}${colors.reset}`);
                }
            });
        } else {
            console.log(`\n${colors.blue}[DRY-RUN] Dry run mode - no files were deleted.${colors.reset}`);
            console.log('   Use --execute to actually delete the files.');
        }
    }
}

function restartServicesAfterLogDeletion() {
    console.log(`\n${colors.blue}[RESTART] Restarting services to release file handles...${colors.reset}`);
    
    // Dynamically detect running containers to restart
    let servicesToRestart = [];
    try {
        const runningContainers = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' }).trim().split('\n');
        
        // Add web, rtsp, and onvif services
        runningContainers.forEach(containerName => {
            if (containerName.includes('web') || containerName.includes('axis') || containerName.includes('dahua') || 
                containerName.includes('hikvision') || containerName.includes('mobotix') || containerName.includes('reolink') || 
                containerName.includes('vstarcam')) {
                servicesToRestart.push(containerName);
            }
            if (containerName.includes('rtsp')) {
                servicesToRestart.push(containerName);
            }
            if (containerName.includes('onvif')) {
                servicesToRestart.push(containerName);
            }
        });
        
        // Always add cowrie-services if it exists
        if (runningContainers.includes('cowrie-services')) {
            servicesToRestart.push('cowrie-services');
        }
        
    } catch (error) {
        console.log(`${colors.yellow}[WARN] Error detecting running containers, using defaults: ${error.message}${colors.reset}`);
        servicesToRestart = [
            'axis_service',
            'rtsp_axis_service', 
            'onvif_axis_service',
            'cowrie-services'
        ];
    }
    
    servicesToRestart.forEach(serviceName => {
        try {
            console.log(`   Restarting ${serviceName}...`);
            execSync(`docker restart ${serviceName}`, { encoding: 'utf8' });
            console.log(`   ${colors.green}[OK] ${serviceName} restarted${colors.reset}`);
        } catch (error) {
            console.log(`   ${colors.red}[ERROR] Failed to restart ${serviceName}: ${error.message}${colors.reset}`);
        }
    });
    
    console.log(`\n${colors.green}[INFO] Services restarted. New log files should now receive logs properly.${colors.reset}`);
    console.log(`${colors.yellow}[NOTE] Wait a few minutes for services to fully start up.${colors.reset}`);
}

function main() {
    parseArgs();
    
    if (config.search) {
        searchLogs(config.search, config.service);
        return;
    }
    
    if (config.deleteByDate !== null) {
        deleteByDate(config.deleteByDate, config.service);
        return;
    }
    
    if (config.deleteOld !== null) {
        deleteOldLogs(config.deleteOld, config.service);
        return;
    }
    
    // Only check logs directory if not using Docker
    if (!config.docker && !fs.existsSync(config.logsDir)) {
        console.log(`${colors.red}[ERROR] Logs directory not found: ${config.logsDir}${colors.reset}`);
        process.exit(1);
    }
    
    const entries = readLogs(config.service, config.date);
    if (entries.length === 0) {
        console.log(`${colors.yellow}[EMPTY] No log entries found.${colors.reset}`);
        return;
    }    
    const filteredEntries = filterLogs(entries);
    
    displayLogs(filteredEntries);
    
    if (config.analyze) {
        analyzeLogs(filteredEntries);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    readLogs,
    filterLogs,
    displayLogs,
    analyzeLogs,
    searchLogs,
    deleteOldLogs,
    deleteByDate
}; 