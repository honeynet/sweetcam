const express = require('express');
const http = require('http');
const soap = require('soap');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const UDPWSDiscoveryService = require('./services/udp-ws-discovery');
const ONVIFSoapService = require('./services/onvif-soap');
const { onvifLogger } = require('./utils/logger');


class ONVIFHoneypot {
  constructor() {
    this.app = express();
    
    this.app.disable('x-powered-by');
    this.app.disable('etag');
    this.app.disable('view cache');
    
    this.server = http.createServer(this.app);
    this.wsDiscovery = new UDPWSDiscoveryService();
    this.soapService = new ONVIFSoapService();
    this.port = process.env.ONVIF_HTTP_PORT || 8080;
    
    this.setupMiddleware();
    this.setupSOAPServices();
    this.setupRoutes();
  }

  setupMiddleware() {    
    this.app.use((req, res, next) => {
      res.removeHeader('X-Powered-By');
      res.removeHeader('X-Content-Type-Options');
      res.removeHeader('X-Frame-Options');
      res.removeHeader('X-XSS-Protection');
      
      res.setHeader('Server', 'ONVIF/1.0');
      res.setHeader('Connection', 'close');
      res.setHeader('Content-Type', 'application/soap+xml; charset=utf-8');
      
      try {
        const brand = this.soapService.brand || 'hikvision';
        onvifLogger.logONVIFConnection(req.ip, 'connected', brand, this.port);
      } catch (error) {
        console.error('Error in ONVIF middleware:', error);
        onvifLogger.logONVIFConnection(req.ip, 'connected', 'hikvision', this.port);
      }
      
      next();
    });
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.setHeader('Server', 'ONVIF/1.0');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      
      onvifLogger.logServiceEvent('health_check', 'Health check requested');
      res.json({ status: 'ok', service: 'onvif-device' });
    });

    this.app.get('/', (req, res) => {
      res.setHeader('Server', 'ONVIF/1.0');
      res.setHeader('Location', '/onvif/device_service');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      
      try {
        const brand = this.soapService.brand || 'hikvision';
        onvifLogger.logSOAPRequest(req.ip, 'GET', req.method, '/', brand, this.port);
      } catch (error) {
        console.error('Error in ONVIF root route:', error);
        onvifLogger.logSOAPRequest(req.ip, 'GET', req.method, '/', 'hikvision', this.port);
      }
      
      res.status(302).send('Found. Redirecting to /onvif/device_service');
    });

    //onvif service endpoints, handle both http get and soap requests
    this.app.all('/onvif/device_service', (req, res, next) => {
      res.setHeader('Server', 'ONVIF/1.0');
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        
        try {
          const brand = this.soapService.brand || 'hikvision';
          onvifLogger.logSOAPRequest(req.ip, 'GET', req.method, '/onvif/device_service', brand, this.port);
          
          const deviceInfo = this.soapService.deviceInfo || {
            manufacturer: 'Unknown',
            model: 'Unknown',
            firmwareVersion: 'Unknown',
            serialNumber: 'Unknown',
            hardwareId: 'Unknown'
          };
          const brandConfig = this.soapService.brandConfig || {
            deviceType: 'IP Camera',
            resolution: '1920x1080',
            onvifVersion: '2.4',
            features: {},
            specifications: {}
          };
        
          res.send(`
          <html>
            <head>
              <title>${deviceInfo.manufacturer} ${deviceInfo.model} - ONVIF Device Service</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
                .device-info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
                .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
                .label { font-weight: bold; color: #555; }
                .value { color: #333; }
                .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
                .feature-card { background: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3; }
                .soap-info { background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff9800; }
                .endpoint { font-family: monospace; background: #f0f0f0; padding: 5px; border-radius: 3px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>${deviceInfo.manufacturer} ${deviceInfo.model}</h1>
                <p><strong>ONVIF Device Service</strong> - This is an ONVIF-compliant device service endpoint.</p>
                
                <div class="device-info">
                  <h3>Device Information</h3>
                  <div class="info-row">
                    <span class="label">Manufacturer:</span>
                    <span class="value">${deviceInfo.manufacturer}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Model:</span>
                    <span class="value">${deviceInfo.model}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Firmware Version:</span>
                    <span class="value">${deviceInfo.firmwareVersion}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Serial Number:</span>
                    <span class="value">${deviceInfo.serialNumber}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Hardware ID:</span>
                    <span class="value">${deviceInfo.hardwareId}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Device Type:</span>
                    <span class="value">${brandConfig.deviceType || 'IP Camera'}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Resolution:</span>
                    <span class="value">${brandConfig.resolution || '1920x1080'}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">ONVIF Version:</span>
                    <span class="value">${brandConfig.onvifVersion || '2.4'}</span>
                  </div>
                </div>

                <div class="features">
                  <div class="feature-card">
                    <h4>Video Specifications</h4>
                    <p><strong>Sensor:</strong> ${brandConfig.specifications?.sensor || '1/3" CMOS'}</p>
                    <p><strong>Lens:</strong> ${brandConfig.specifications?.lens || '2.8mm'}</p>
                    <p><strong>Frame Rate:</strong> ${brandConfig.specifications?.fps || '30fps@1080p'}</p>
                    <p><strong>Compression:</strong> ${brandConfig.specifications?.compression || 'H.264'}</p>
                  </div>
                  
                  <div class="feature-card">
                    <h4>Features</h4>
                    <p><strong>Night Vision:</strong> ${brandConfig.features?.nightVision ? 'Yes' : 'No'}</p>
                    <p><strong>Motion Detection:</strong> ${brandConfig.features?.motionDetection ? 'Yes' : 'No'}</p>
                    <p><strong>Audio:</strong> ${brandConfig.features?.audio ? 'Yes' : 'No'}</p>
                    <p><strong>PTZ:</strong> ${brandConfig.features?.ptz ? 'Yes' : 'No'}</p>
                    ${brandConfig.features?.waterproof ? `<p><strong>Waterproof:</strong> ${brandConfig.features.waterproof}</p>` : ''}
                  </div>
                </div>

                <div class="soap-info">
                  <h3>SOAP Service Endpoints</h3>
                  <p>Use SOAP requests to interact with the device:</p>
                  <p><strong>Device Service:</strong> <span class="endpoint">/onvif/device_service</span></p>
                  <p><strong>Media Service:</strong> <span class="endpoint">/onvif/media_service</span></p>
                  <p><strong>Available Methods:</strong> GetDeviceInformation, GetServices, GetCapabilities, GetNetworkInterfaces, GetSystemDateAndTime, GetSystemLog, GetUsers, CreateUsers, DeleteUsers, SetSystemDateAndTime, SystemReboot</p>
                </div>
              </div>
            </body>
          </html>
        `);
        } catch (error) {
          console.error('Error in ONVIF device service route:', error);
          onvifLogger.logONVIFError(error, 'device_service_error', req.ip, this.soapService?.brandConfig?.brand || 'hikvision', this.port);
          res.status(500).send(`
            <html>
              <head><title>500 Internal Server Error</title></head>
              <body>
                <h1>500 Internal Server Error</h1>
                <p>ONVIF/1.0 device service</p>
              </body>
            </html>
          `);
        }
      } else {
        res.setHeader('Content-Type', 'application/soap+xml; charset=utf-8');
        next();
      }
    });

    this.app.all('/onvif/media_service', (req, res, next) => {
      res.setHeader('Server', 'ONVIF/1.0');
      
      //if a header is a get request, serve html page with media information
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        
        try {
          const brand = this.soapService.brand || 'hikvision';
          onvifLogger.logSOAPRequest(req.ip, 'GET', req.method, '/onvif/media_service', brand, this.port);
          
          const deviceInfo = this.soapService.deviceInfo || {
            manufacturer: 'Unknown',
            model: 'Unknown',
            firmwareVersion: 'Unknown',
            serialNumber: 'Unknown',
            hardwareId: 'Unknown'
          };
          const brandConfig = this.soapService.brandConfig || {
            deviceType: 'IP Camera',
            resolution: '1920x1080',
            onvifVersion: '2.4',
            features: {},
            specifications: {}
          };
        
        res.send(`
          <html>
            <head>
              <title>${deviceInfo.manufacturer} ${deviceInfo.model} - ONVIF Media Service</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
                .media-info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
                .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
                .label { font-weight: bold; color: #555; }
                .value { color: #333; }
                .capabilities { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
                .capability-card { background: #e8f5e8; padding: 15px; border-radius: 5px; border-left: 4px solid #4caf50; }
                .streaming-card { background: #fff3e0; padding: 15px; border-radius: 5px; border-left: 4px solid #ff9800; }
                .soap-info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196f3; }
                .endpoint { font-family: monospace; background: #f0f0f0; padding: 5px; border-radius: 3px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>${deviceInfo.manufacturer} ${deviceInfo.model} - Media Service</h1>
                <p><strong>ONVIF Media Service</strong> - This is an ONVIF-compliant media service endpoint for video and audio streaming.</p>
                
                <div class="media-info">
                  <h3>Device Information</h3>
                  <div class="info-row">
                    <span class="label">Manufacturer:</span>
                    <span class="value">${deviceInfo.manufacturer}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Model:</span>
                    <span class="value">${deviceInfo.model}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Firmware Version:</span>
                    <span class="value">${deviceInfo.firmwareVersion}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Serial Number:</span>
                    <span class="value">${deviceInfo.serialNumber}</span>
                  </div>
                </div>

                <div class="capabilities">
                  <div class="capability-card">
                    <h4>Video Capabilities</h4>
                    <p><strong>Resolution:</strong> ${brandConfig.resolution || '1920x1080'}</p>
                    <p><strong>Sensor:</strong> ${brandConfig.specifications?.sensor || '1/3" CMOS'}</p>
                    <p><strong>Lens:</strong> ${brandConfig.specifications?.lens || '2.8mm'}</p>
                    <p><strong>Frame Rate:</strong> ${brandConfig.specifications?.fps || '30fps@1080p'}</p>
                    <p><strong>Compression:</strong> ${brandConfig.specifications?.compression || 'H.264'}</p>
                  </div>
                  
                  <div class="streaming-card">
                    <h4>Streaming Features</h4>
                    <p><strong>RTSP Support:</strong> Yes</p>
                    <p><strong>Multicast:</strong> No</p>
                    <p><strong>TCP Streaming:</strong> Yes</p>
                    <p><strong>Audio Support:</strong> ${brandConfig.features?.audio ? 'Yes' : 'No'}</p>
                    <p><strong>PTZ Support:</strong> ${brandConfig.features?.ptz ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                <div class="soap-info">
                  <h3>Media Service Endpoints</h3>
                  <p>Use SOAP requests to interact with the media service:</p>
                  <p><strong>Media Service:</strong> <span class="endpoint">/onvif/media_service</span></p>
                  <p><strong>Device Service:</strong> <span class="endpoint">/onvif/device_service</span></p>
                  <p><strong>Available Methods:</strong> GetProfiles, GetStreamUri, GetVideoSources, GetAudioSources, GetVideoEncoderConfigurations, GetAudioEncoderConfigurations</p>
                  <p><strong>Stream URI Format:</strong> <span class="endpoint">rtsp://127.0.0.1:554/}</span></p>
                </div>
              </div>
            </body>
          </html>
        `);
        } catch (error) {
          console.error('Error in ONVIF media service route:', error);
          onvifLogger.logONVIFError(error, 'media_service_error', req.ip, this.soapService?.brandConfig?.brand || 'hikvision', this.port);
          res.status(500).send(`
            <html>
              <head><title>500 Internal Server Error</title></head>
              <body>
                <h1>500 Internal Server Error</h1>
                <p>ONVIF/1.0 media service</p>
              </body>
            </html>
          `);
        }
      } else {
        res.setHeader('Content-Type', 'application/soap+xml; charset=utf-8');
        next();
      }
    });

    //catch all for unknown endpoints
    this.app.use('*', (req, res) => {
      res.setHeader('Server', 'ONVIF/1.0');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      
      try {
        const brand = this.soapService.brand || 'hikvision';
        onvifLogger.logSOAPRequest(req.ip, req.method, req.url, brand, this.port);
        
        res.status(404).send(`
          <html>
            <head><title>404 Not Found</title></head>
            <body>
              <h1>404 Not Found</h1>
              <p>ONVIF/1.0 device service</p>
            </body>
          </html>
        `);
        } catch (error) {
          console.error('Error in ONVIF catch-all route:', error);
          onvifLogger.logONVIFError(error, 'catch_all_error', req.ip, this.soapService?.brandConfig?.brand || 'hikvision', this.port);
          res.status(500).send(`
            <html>
              <head><title>500 Internal Server Error</title></head>
              <body>
                <h1>500 Internal Server Error</h1>
                <p>ONVIF/1.0 device service</p>
              </body>
            </html>
          `);
        }
      });
  }

  setupSOAPServices() {
    //create WSDL content for device service
    const deviceWsdl = this.createDeviceWSDL();
    
    //create WSDL content for media service
    const mediaWsdl = this.createMediaWSDL();

    //setup SOAP services with custom handling
    const deviceSoapServer = soap.listen(this.server, '/onvif/device_service/soap', this.soapService.createDeviceService(), deviceWsdl);
    const mediaSoapServer = soap.listen(this.server, '/onvif/media_service/soap', this.soapService.createMediaService(), mediaWsdl);

    // Log SOAP-level events (no direct access to HTTP req/res here)
    deviceSoapServer.on('request', (xml, methodName) => {
      try {
        onvifLogger.logSOAPRequest(null, methodName, 'POST', '/onvif/device_service/soap', this.soapService.brand, this.port);
      } catch (error) {
        onvifLogger.logONVIFError(error, 'device_service_soap_request', null, this.soapService.brand, this.port);
      }
    });
    deviceSoapServer.on('response', (xml, methodName) => {
      try {
        onvifLogger.logSOAPResponse(null, methodName, 200, this.soapService.brand, this.port);
      } catch (error) {
        onvifLogger.logONVIFError(error, 'device_service_soap_response', null, this.soapService.brand, this.port);
      }
    });
    deviceSoapServer.on('soapError', (err) => {
      onvifLogger.logONVIFError(err, 'device_service_soap_error', null, this.soapService.brand, this.port);
    });

    mediaSoapServer.on('request', (xml, methodName) => {
      try {
        onvifLogger.logSOAPRequest(null, methodName, 'POST', '/onvif/media_service/soap', this.soapService.brand, this.port);
      } catch (error) {
        onvifLogger.logONVIFError(error, 'media_service_soap_request', null, this.soapService.brand, this.port);
      }
    });
    mediaSoapServer.on('response', (xml, methodName) => {
      try {
        onvifLogger.logSOAPResponse(null, methodName, 200, this.soapService.brand, this.port);
      } catch (error) {
        onvifLogger.logONVIFError(error, 'media_service_soap_response', null, this.soapService.brand, this.port);
      }
    });
    mediaSoapServer.on('soapError', (err) => {
      onvifLogger.logONVIFError(err, 'media_service_soap_error', null, this.soapService.brand, this.port);
    });

    // Also tap the underlying HTTP server to capture client IP, URL, and status for SOAP POSTs
    this.server.on('request', (req, res) => {
      try {
        const isSoapPost = req.method === 'POST' && req.url && req.url.startsWith('/onvif/') && req.url.endsWith('/soap');
        if (!isSoapPost) return;

        // Ensure Server header for SOAP replies
        res.setHeader('Server', 'ONVIF/1.0');

        const ip = (req.socket && req.socket.remoteAddress) || req.headers['x-forwarded-for'] || null;

        // Extract SOAPAction from header or content-type parameter (SOAP 1.2)
        let soapAction = req.headers['soapaction'];
        if (!soapAction && typeof req.headers['content-type'] === 'string') {
          const m = req.headers['content-type'].match(/action="([^"]+)"/i);
          if (m) soapAction = m[1];
        }

        onvifLogger.logSOAPRequest(ip, soapAction || 'unknown', req.method, req.url, this.soapService.brand, this.port);

        res.on('finish', () => {
          onvifLogger.logSOAPResponse(ip, soapAction || 'unknown', res.statusCode, this.soapService.brand, this.port);
        });
      } catch (error) {
        onvifLogger.logONVIFError(error, 'http_server_soap_logging', null, this.soapService.brand, this.port);
      }
    });
  }

  createDeviceWSDL() { //types, messages, portType, binding, service
    return `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="DeviceService"
             targetNamespace="http://www.onvif.org/ver10/device/wsdl"
             xmlns:tns="http://www.onvif.org/ver10/device/wsdl"
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema"
             xmlns="http://schemas.xmlsoap.org/wsdl/">

  <types>
    <xsd:schema targetNamespace="http://www.onvif.org/ver10/device/wsdl">
      <xsd:element name="GetDeviceInformation">
        <xsd:complexType>
          <xsd:sequence/>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetDeviceInformationResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Manufacturer" type="xsd:string"/>
            <xsd:element name="Model" type="xsd:string"/>
            <xsd:element name="FirmwareVersion" type="xsd:string"/>
            <xsd:element name="SerialNumber" type="xsd:string"/>
            <xsd:element name="HardwareId" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      
      <xsd:element name="GetCapabilities">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Category" type="xsd:string" minOccurs="0" maxOccurs="unbounded"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetCapabilitiesResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Capabilities" type="xsd:anyType"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      
      <xsd:element name="GetServices">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="IncludeCapability" type="xsd:boolean" minOccurs="0"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetServicesResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Service" type="xsd:anyType" maxOccurs="unbounded"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      
      <xsd:element name="GetNetworkInterfaces">
        <xsd:complexType>
          <xsd:sequence/>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetNetworkInterfacesResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="NetworkInterfaces" type="xsd:anyType"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      
      <xsd:element name="GetSystemDateAndTime">
        <xsd:complexType>
          <xsd:sequence/>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetSystemDateAndTimeResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="SystemDateTime" type="xsd:anyType"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      
      <xsd:element name="GetSystemLog">
        <xsd:complexType>
          <xsd:sequence/>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetSystemLogResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="SystemLog" type="xsd:anyType"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>

  <message name="GetDeviceInformationRequest">
    <part name="body" element="tns:GetDeviceInformation"/>
  </message>
  <message name="GetDeviceInformationResponse">
    <part name="body" element="tns:GetDeviceInformationResponse"/>
  </message>
  
  <message name="GetCapabilitiesRequest">
    <part name="body" element="tns:GetCapabilities"/>
  </message>
  <message name="GetCapabilitiesResponse">
    <part name="body" element="tns:GetCapabilitiesResponse"/>
  </message>
  
  <message name="GetServicesRequest">
    <part name="body" element="tns:GetServices"/>
  </message>
  <message name="GetServicesResponse">
    <part name="body" element="tns:GetServicesResponse"/>
  </message>
  
  <message name="GetNetworkInterfacesRequest">
    <part name="body" element="tns:GetNetworkInterfaces"/>
  </message>
  <message name="GetNetworkInterfacesResponse">
    <part name="body" element="tns:GetNetworkInterfacesResponse"/>
  </message>
  
  <message name="GetSystemDateAndTimeRequest">
    <part name="body" element="tns:GetSystemDateAndTime"/>
  </message>
  <message name="GetSystemDateAndTimeResponse">
    <part name="body" element="tns:GetSystemDateAndTimeResponse"/>
  </message>
  
  <message name="GetSystemLogRequest">
    <part name="body" element="tns:GetSystemLog"/>
  </message>
  <message name="GetSystemLogResponse">
    <part name="body" element="tns:GetSystemLogResponse"/>
  </message>

  <portType name="DeviceBinding">
    <operation name="GetDeviceInformation">
      <input message="tns:GetDeviceInformationRequest"/>
      <output message="tns:GetDeviceInformationResponse"/>
    </operation>
    <operation name="GetCapabilities">
      <input message="tns:GetCapabilitiesRequest"/>
      <output message="tns:GetCapabilitiesResponse"/>
    </operation>
    <operation name="GetServices">
      <input message="tns:GetServicesRequest"/>
      <output message="tns:GetServicesResponse"/>
    </operation>
    <operation name="GetNetworkInterfaces">
      <input message="tns:GetNetworkInterfacesRequest"/>
      <output message="tns:GetNetworkInterfacesResponse"/>
    </operation>
    <operation name="GetSystemDateAndTime">
      <input message="tns:GetSystemDateAndTimeRequest"/>
      <output message="tns:GetSystemDateAndTimeResponse"/>
    </operation>
    <operation name="GetSystemLog">
      <input message="tns:GetSystemLogRequest"/>
      <output message="tns:GetSystemLogResponse"/>
    </operation>
  </portType>

  <binding name="DeviceBinding" type="tns:DeviceBinding">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="GetDeviceInformation">
      <soap:operation soapAction="http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="GetCapabilities">
      <soap:operation soapAction="http://www.onvif.org/ver10/device/wsdl/GetCapabilities"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="GetServices">
      <soap:operation soapAction="http://www.onvif.org/ver10/device/wsdl/GetServices"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="GetNetworkInterfaces">
      <soap:operation soapAction="http://www.onvif.org/ver10/device/wsdl/GetNetworkInterfaces"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="GetSystemDateAndTime">
      <soap:operation soapAction="http://www.onvif.org/ver10/device/wsdl/GetSystemDateAndTime"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="GetSystemLog">
      <soap:operation soapAction="http://www.onvif.org/ver10/device/wsdl/GetSystemLog"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
  </binding>

  <service name="DeviceService">
    <port name="DeviceBinding" binding="tns:DeviceBinding">
      <soap:address location="http://192.168.1.100:8080/onvif/device_service"/>
    </port>
  </service>
</definitions>`;
  }

  createMediaWSDL() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="MediaService"
             targetNamespace="http://www.onvif.org/ver10/media/wsdl"
             xmlns:tns="http://www.onvif.org/ver10/media/wsdl"
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema"
             xmlns="http://schemas.xmlsoap.org/wsdl/">

  <types>
    <xsd:schema targetNamespace="http://www.onvif.org/ver10/media/wsdl">
      <xsd:element name="GetProfiles">
        <xsd:complexType>
          <xsd:sequence/>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetProfilesResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Profiles" type="xsd:anyType"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>

  <message name="GetProfilesRequest">
    <part name="body" element="tns:GetProfiles"/>
  </message>
  <message name="GetProfilesResponse">
    <part name="body" element="tns:GetProfilesResponse"/>
  </message>

  <portType name="MediaBinding">
    <operation name="GetProfiles">
      <input message="tns:GetProfilesRequest"/>
      <output message="tns:GetProfilesResponse"/>
    </operation>
  </portType>

  <binding name="MediaBinding" type="tns:MediaBinding">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="GetProfiles">
      <soap:operation soapAction="http://www.onvif.org/ver10/media/wsdl/GetProfiles"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
  </binding>

  <service name="MediaService">
    <port name="MediaBinding" binding="tns:MediaBinding">
      <soap:address location="http://192.168.1.100:3702/onvif/media_service"/>
    </port>
  </service>
</definitions>`;
  }

  async start() {
    try {
      await this.wsDiscovery.start();

      this.server.listen(this.port, () => {

        
        onvifLogger.logONVIFServiceEvent('started', `ONVIF service started on port ${this.port}`, this.soapService.brandConfig.brand, this.port);
      });

    } catch (error) {
      console.error('Failed to start ONVIF:', error.message);
      onvifLogger.logONVIFError(error, 'startup', null, this.soapService.brandConfig.brand, this.port);
      process.exit(1);
    }
  }

  stop() {
    this.wsDiscovery.stop();
    this.server.close();
    
    onvifLogger.logONVIFServiceEvent('stopped', 'ONVIF service stopped', this.soapService.brandConfig.brand, this.port);
  }
}

//handle shutdown
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

//start the onvif server
if (require.main === module) {
  const onvif = new ONVIFHoneypot();
  onvif.start().catch(error => {
    console.error('Failed to start ONVIF:', error.message);
    process.exit(1);
  });
}

module.exports = ONVIFHoneypot; 