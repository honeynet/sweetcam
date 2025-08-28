const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
    
    this.sessions = new Map(); 
    this.sessionTimeout = 30 * 60 * 1000; 
    
    this.setupMiddleware();
    this.setupSOAPServices();
    this.setupRoutes();
    
    setInterval(() => this.cleanupSessions(), 5 * 60 * 1000);
    
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  getOrCreateSession(ip) {
    const now = Date.now();
    
    if (this.sessions.has(ip)) {
      const session = this.sessions.get(ip);
      if (now - session.lastActivity < this.sessionTimeout) {
        //update last activity
        session.lastActivity = now;
        return session.id;
      } else {
        this.sessions.delete(ip);
      }
    }
    
    const sessionId = this.generateSessionId();
    this.sessions.set(ip, {
      id: sessionId,
      createdAt: now,
      lastActivity: now,
      requestCount: 0
    });
    
    return sessionId;
  }

  updateSessionActivity(ip) {
    if (this.sessions.has(ip)) {
      const session = this.sessions.get(ip);
      session.lastActivity = Date.now();
      session.requestCount++;
    }
  }

  cleanupSessions() {
    const now = Date.now();
    for (const [ip, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        this.sessions.delete(ip);
      }
    }
  }



  setupMiddleware() {    
    this.app.use((req, res, next) => {
      res.removeHeader('X-Powered-By');
      res.removeHeader('X-Content-Type-Options');
      res.removeHeader('X-Frame-Options');
      res.removeHeader('X-XSS-Protection');
      
      res.setHeader('Server', 'ONVIF/1.0');
      res.setHeader('Connection', 'close');
      
      if (req.path.startsWith('/onvif/') || req.path === '/') {
        res.setHeader('Content-Type', 'application/soap+xml; charset=utf-8');
      }
      
      const sessionId = this.getOrCreateSession(req.ip);
      
      const originalSend = res.send;
      const honeypotInstance = this; 
      res.send = function(data) {
        const statusCode = res.statusCode;
        try {
          const brand = honeypotInstance.soapService?.brand || 'hikvision';
          const userAgent = req.headers['user-agent'] || null;
          
          const requestHeaders = req.headers;
          const requestBody = null; 
          const responseHeaders = res.getHeaders();
          const responseBody = data;
          
          onvifLogger.logHTTPRequestResponse(
            req.ip, 
            req.method, 
            req.url, 
            statusCode, 
            brand, 
            honeypotInstance.port, 
            userAgent, 
            sessionId, 
            requestHeaders, 
            requestBody, 
            responseHeaders, 
            responseBody
          );
          
        } catch (error) {
          console.error('Error in ONVIF middleware response logging:', error);
        }
        return originalSend.call(this, data);
      };
      
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
      
      const sessionId = this.getOrCreateSession(req.ip);
      this.updateSessionActivity(req.ip);
      
      try {
        const brand = this.soapService.brand || 'hikvision';
        const userAgent = req.headers['user-agent'] || null;
        
        const requestHeaders = req.headers;
        const requestBody = null; 
        
        const responseBody = 'Found. Redirecting to /onvif/device_service';
        res.status(302).send(responseBody);
        
        const responseHeaders = res.getHeaders();
        
        
      } catch (error) {
        console.error('Error in ONVIF root route:', error);
        const userAgent = req.headers['user-agent'] || null;
        const sessionId = this.getOrCreateSession(req.ip);
                
        res.status(500).send('Internal Server Error');
      }
    });

    //onvif service endpoints, handle both http get and soap requests for both device and media service
    this.app.all('/onvif/device_service', (req, res, next) => {
      res.setHeader('Server', 'ONVIF/1.0');
      
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        
        try {
          const brand = this.soapService.brand || 'hikvision';
          const userAgent = req.headers['user-agent'] || null;
          const sessionId = this.getOrCreateSession(req.ip);
          this.updateSessionActivity(req.ip);
          
          const requestHeaders = req.headers;
          const requestBody = null; 
          
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
        
          const htmlResponse = `
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
                    <p><strong>Night Vision:</strong> Yes</p>
                    <p><strong>Motion Detection:</strong> Yes</p>
                    <p><strong>Audio:</strong> Yes</p>
                    <p><strong>PTZ:</strong> No</p>
                    <p><strong>Waterproof:</strong> IP66</p>
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
          </html>`;
          
          res.status(200).send(htmlResponse);
          
          const responseHeaders = res.getHeaders();
          const responseBody = htmlResponse;
          
          
        } catch (error) {
          console.error('Error in ONVIF device service GET handler:', error);
          const userAgent = req.headers['user-agent'] || null;
          const sessionId = this.getOrCreateSession(req.ip);
          
          
          res.status(500).send('Internal Server Error');
        }
      } else {
        res.setHeader('Content-Type', 'application/soap+xml; charset=utf-8');
        next();
      }
    });

    this.app.all('/onvif/media_service', (req, res, next) => {
      res.setHeader('Server', 'ONVIF/1.0');
      
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        
        try {
          const brand = this.soapService.brand || 'hikvision';
          const userAgent = req.headers['user-agent'] || null;
          const sessionId = this.getOrCreateSession(req.ip);
          this.updateSessionActivity(req.ip);
          
          const requestHeaders = req.headers;
          const requestBody = null; 
          
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
        
        const htmlResponse = `
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
                  <p><strong>Stream URI Format:</strong> <span class="endpoint">rtsp://127.0.0.1:554/</span></p>
                </div>
              </div>
            </body>
          </html>`;
          
          res.status(200).send(htmlResponse);
          
          const responseHeaders = res.getHeaders();
          const responseBody = htmlResponse;
          
          onvifLogger.logHTTPRequestResponse(
            req.ip, 
            req.method, 
            req.url, 
            200, 
            brand, 
            this.port, 
            userAgent, 
            sessionId, 
            requestHeaders, 
            requestBody, 
            responseHeaders, 
            responseBody
          );
          
        } catch (error) {
          console.error('Error in ONVIF media service GET handler:', error);
          const userAgent = req.headers['user-agent'] || null;
          const sessionId = this.getOrCreateSession(req.ip);
          
          onvifLogger.logHTTPRequestResponse(
            req.ip, 
            req.method, 
            req.url, 
            500, 
            'hikvision', 
            this.port, 
            userAgent, 
            sessionId, 
            req.headers, 
            null, 
            res.getHeaders(), 
            'Internal Server Error'
          );
          
          res.status(500).send('Internal Server Error');
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
        const userAgent = req.headers['user-agent'] || null;
        const sessionId = this.getOrCreateSession(req.ip);
        this.updateSessionActivity(req.ip);
        
        const requestHeaders = req.headers;
        const requestBody = null; 
        
        const responseBody = `
          <html>
            <head><title>404 Not Found</title></head>
            <body>
              <h1>404 Not Found</h1>
              <p>ONVIF/1.0 device service</p>
            </body>
          </html>`;
        
        res.status(404).send(responseBody);
        
        const responseHeaders = res.getHeaders();
        
        onvifLogger.logHTTPRequestResponse(
          req.ip, 
          req.method, 
          req.url, 
          404, 
          brand, 
          this.port, 
          userAgent, 
          sessionId, 
          requestHeaders, 
          requestBody, 
          responseHeaders, 
          responseBody
        );
        
        } catch (error) {
          console.error('Error in ONVIF catch-all route:', error);
          const userAgent = req.headers['user-agent'] || null;
          const sessionId = this.getOrCreateSession(req.ip);
          
          onvifLogger.logHTTPRequestResponse(
            req.ip, 
            req.method, 
            req.url, 
            500, 
            'hikvision', 
            this.port, 
            userAgent, 
            sessionId, 
            req.headers, 
            null, 
            res.getHeaders(), 
            'Internal Server Error'
          );
          
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
    const deviceWsdl = this.createDeviceWSDL();
    
    const mediaWsdl = this.createMediaWSDL();

    const deviceService = this.soapService.createDeviceService();
    const mediaService = this.soapService.createMediaService();

    this.app.post('/onvif/device_service/soap', (req, res) => {
      this.handleSOAPRequest(req, res, deviceService, deviceWsdl, 'device_service');
    });

    this.app.post('/onvif/media_service/soap', (req, res) => {
      this.handleSOAPRequest(req, res, mediaService, mediaWsdl, 'media_service');
    });
  }

  async handleSOAPRequest(req, res, service, wsdl, serviceType) {
    try {
      res.setHeader('Content-Type', 'application/soap+xml; charset=utf-8');
      res.setHeader('Server', 'ONVIF/1.0');
      
      const ip = req.ip;
      const userAgent = req.headers['user-agent'] || null;
      const sessionId = this.getOrCreateSession(ip);
      this.updateSessionActivity(ip);
      
      let soapAction = req.headers['soapaction'];
      if (!soapAction && typeof req.headers['content-type'] === 'string') {
        const m = req.headers['content-type'].match(/action="([^"]+)"/i);
        if (m) soapAction = m[1];
      }
      
      let requestBody = '';
      req.on('data', (chunk) => {
        requestBody += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const methodName = this.extractSOAPMethod(requestBody);
          
          onvifLogger.logSOAPRequest(
            ip, 
            methodName || soapAction || 'unknown', 
            req.method, 
            req.url, 
            this.soapService.brand, 
            this.port, 
            userAgent, 
            200, 
            sessionId
          );
          
          const result = await this.processSOAPRequest(requestBody, service, methodName);
          
          const soapResponse = this.createSOAPResponse(result, methodName);
          
          const requestPayload = {
            method: req.method,
            url: req.url,
            soap_action: soapAction,
            envelope: requestBody, 
            service: serviceType,
            headers: req.headers,
            body: requestBody,
            soap_method: methodName
          };
          
          const responsePayload = {
            envelope: soapResponse, 
            method: methodName,
            service: serviceType,
            status: 200,
            headers: res.getHeaders(),
            body: soapResponse,
            soap_method: methodName
          };
          
          onvifLogger.logONVIFSOAPWithPayload(
            ip, 
            req.method, 
            req.url, 
            200, 
            sessionId, 
            this.soapService.brand, 
            this.port,
            methodName || soapAction,
            userAgent,
            requestPayload,
            responsePayload
          );
          
          res.status(200).send(soapResponse);
          
        } catch (error) {
          console.error('Error processing SOAP request:', error);
          onvifLogger.logONVIFError(error, `${serviceType}_soap_error`, ip, this.soapService.brand, this.port);
          
          const faultResponse = this.createSOAPFault(error.message);
          res.status(500).send(faultResponse);
        }
      });
      
    } catch (error) {
      console.error('Error in SOAP request handler:', error);
      onvifLogger.logONVIFError(error, `${serviceType}_handler_error`, req.ip, this.soapService.brand, this.port);
      res.status(500).send('Internal Server Error');
    }
  }

  extractSOAPMethod(xmlBody) {
    try {
      const bodyMatch = xmlBody.match(/<soap:Body[^>]*>(.*?)<\/soap:Body>/s);
      if (bodyMatch) {
        const bodyContent = bodyMatch[1];
        const methodMatch = bodyContent.match(/<([^\/\s>]+)[\s>]/);
        if (methodMatch) {
          return methodMatch[1];
        }
      }
      
      const fallbackMatch = xmlBody.match(/<(Get\w+|Set\w+|Create\w+|Delete\w+)[\s>]/);
      return fallbackMatch ? fallbackMatch[1] : 'UnknownMethod';
    } catch (error) {
      return 'UnknownMethod';
    }
  }

  async processSOAPRequest(xmlBody, service, methodName) {
    return new Promise((resolve, reject) => {
      try {
        const callback = (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        };
        
        if (service[methodName] && typeof service[methodName] === 'function') {
          service[methodName]({}, callback);
        } else {
          reject(new Error(`Method ${methodName} not found`));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  createSOAPResponse(result, methodName) {
    const response = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://www.onvif.org/ver10/device/wsdl">
  <soap:Body>
    <${methodName}Response>
      ${this.formatSOAPResult(result)}
    </${methodName}Response>
  </soap:Body>
</soap:Envelope>`;
    
    return response;
  }

  formatSOAPResult(result) {
    if (!result) return '';
    
    let formatted = '';
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'object' && value !== null) {
        formatted += `<${key}>${this.formatSOAPResult(value)}</${key}>`;
      } else {
        formatted += `<${key}>${value}</${key}>`;
      }
    }
    return formatted;
  }

  createSOAPFault(message) {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://www.onvif.org/ver10/device/wsdl">
  <soap:Body>
    <soap:Fault>
      <soap:Code>
        <soap:Value>SOAP-ENV:Server</soap:Value>
        <soap:Subcode>
          <soap:Value>InternalServerError</soap:Value>
        </soap:Subcode>
      </soap:Code>
      <soap:Reason>
        <soap:Text>${message}</soap:Text>
      </soap:Reason>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
  }



  createDeviceWSDL() { 
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