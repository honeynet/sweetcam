# ONVIF 
This ONVIF implements the ONVIF standard to create a fake IP camera that appears as a genuine device to attackers. 

It provides:

- **WS-Discovery Service** (UDP 3702) - device discovery via multicast
- **SOAP Services** (TCP 8080) - ONVIF device and media services
- **Realistic Responses** - Mimics actual device behavior

## Architecture

```
onvifservices/
├── onvif-server.js          # Main server orchestrator
├── services/
│   ├── udp-ws-discovery.js  # WS-Discovery service (UDP 3702)
│   └── onvif-soap.js        # SOAP services (HTTP 8080)
├── config/
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

### Test HTTP services
```shell
# Scan TCP port 8080
sudo nmap -sV -p 8080 127.0.0.1

# Expected result: PORT 8080/tcp open http-proxy ONVIF/1.0
```

### Test SOAP services
```shell
# Test device information
curl -X POST http://127.0.0.1:8080/onvif/device_service \
  -H "Content-Type: text/xml; charset=utf-8" \
  -H "SOAPAction: http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation" \
  -d '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><soap:Header/><soap:Body><tds:GetDeviceInformation/></soap:Body></soap:Envelope>'
```

### Test health check
```shell
curl http://127.0.0.1:8080/health
# Expected: {"status":"ok","service":"onvif-device"}
```
