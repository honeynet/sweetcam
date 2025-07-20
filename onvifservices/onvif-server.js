const express = require('express');
const http = require('http');
const soap = require('soap');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const UDPWSDiscoveryService = require('./services/udp-ws-discovery');
const ONVIFSoapService = require('./services/onvif-soap');


class ONVIFHoneypot {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wsDiscovery = new UDPWSDiscoveryService();
    this.soapService = new ONVIFSoapService();
    this.port = process.env.ONVIF_HTTP_PORT || 8080;
    
    this.setupMiddleware();
    this.setupSOAPServices();
    this.setupRoutes();
  }

  setupMiddleware() {    
    //basic security headers
    this.app.use((req, res, next) => {
      res.setHeader('Server', 'ONVIF/1.0');
      res.setHeader('X-Powered-By', 'ONVIF');
      next();
    });
  }

  setupRoutes() {
    //health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'onvif-device' });
    });

    //root endpoint, redirect to device service
    this.app.get('/', (req, res) => {
      res.redirect('/onvif/device_service');
    });

    //onvif service endpoints - handle both HTTP GET and SOAP requests
    this.app.all('/onvif/device_service', (req, res, next) => {
      // If it's a GET request, serve HTML page
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'text/html');
        res.send(`
          <html>
            <head><title>ONVIF Device Service</title></head>
            <body>
              <h1>ONVIF Device Service</h1>
              <p>This is an ONVIF-compliant device service endpoint.</p>
              <p>Use SOAP requests to interact with the device.</p>
            </body>
          </html>
        `);
      } else {
        // For other methods (POST, etc.), let SOAP handle it
        next();
      }
    });

    this.app.all('/onvif/media_service', (req, res, next) => {
      // If it's a GET request, serve HTML page
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'text/html');
        res.send(`
          <html>
            <head><title>ONVIF Media Service</title></head>
            <body>
              <h1>ONVIF Media Service</h1>
              <p>This is an ONVIF-compliant media service endpoint.</p>
              <p>Use SOAP requests to interact with the media service.</p>
            </body>
          </html>
        `);
      } else {
        // For other methods (POST, etc.), let SOAP handle it
        next();
      }
    });

    //catch all for unknown endpoints
    this.app.use('*', (req, res) => {
      const sourceIp = req.ip || req.connection.remoteAddress;      
      res.status(404).send('Not Found');
    });
  }

  setupSOAPServices() {
    //create WSDL content for device service
    const deviceWsdl = this.createDeviceWSDL();
    
    //create WSDL content for media service
    const mediaWsdl = this.createMediaWSDL();

    //setup SOAP services with custom handling
    soap.listen(this.server, '/onvif/device_service/soap', this.soapService.createDeviceService(), deviceWsdl);

    soap.listen(this.server, '/onvif/media_service/soap', this.soapService.createMediaService(), mediaWsdl);
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
        console.log('Services available:');
        console.log(`- WS-Discovery: UDP 3702 (multicast 239.255.255.250)`);
        console.log(`- Device Service: http://localhost:${this.port}/onvif/device_service`);
        console.log(`- Media Service: http://localhost:${this.port}/onvif/media_service`);
        console.log(`- Health Check: http://localhost:${this.port}/health`);
      });

    } catch (error) {
      console.error('Failed to start ONVIF:', error.message);
      process.exit(1);
    }
  }

  stop() {
    this.wsDiscovery.stop();
    this.server.close();
    console.log('ONVIF stopped');
  }
}

//handle shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
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