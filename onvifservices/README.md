# ONVIF 
This ONVIF implements the ONVIF standard to create a fake IP camera that appears as a genuine device to attackers. 

It provides:

- **WS-Discovery Service** (UDP 3702) - device discovery via multicast
- **SOAP Services** (TCP 8080, 8086-8090) - ONVIF device and media services
- **Realistic Responses** - Mimics actual device behavior

## Architecture

```
onvifservices/
├── onvif-server.js          # Main server orchestrator
├── services/
│   ├── udp-ws-discovery.js  # WS-Discovery service (UDP 3702)
│   └── onvif-soap.js        # SOAP services (HTTP 8080, 8086-8090)
├── config/
│   ├── brand-configs.js     # Device brand configurations
│   └── db-config.js         # Database configuration
├── Dockerfile               # Container configuration
├── package.json             # Project dependencies
└── package-lock.json        # Project dependencies lock file

```

## Testing

### Test WS-Discovery
```shell

# Scan UDP port 3702
sudo nmap -sU -p 3702 127.0.0.1

# Expected result: PORT 3702/udp open|filtered ws-discovery
```

### Test HTTP Services
```shell
# Scan TCP ports
sudo nmap -sV -p 8080,8086-8090 127.0.0.1

# Expected result: Ports detected as ONVIF/1.0 services
```

### Test Health Check
```shell
curl http://127.0.0.1:8080/health
# Expected: {"status":"ok","service":"onvif-device"}
```

### Test SOAP services
```shell
# Test device information
curl -s http://127.0.0.1:8080/onvif/device_service 

# Test media services
curl -s http://127.0.0.1:8080/onvif/media_service 
```


