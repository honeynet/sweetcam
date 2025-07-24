const dgram = require('dgram');
const { v4: uuidv4 } = require('uuid');
const brandConfigs = require('../config/brand-configs');

class UDPWSDiscoveryService {
  constructor() {
    // Get brand from environment variable, default to hikvision
    this.brand = process.env.ONVIF_BRAND || 'hikvision';
    this.brandConfig = brandConfigs[this.brand] || brandConfigs.hikvision;
    
    this.deviceInfo = {
      manufacturer: this.brandConfig.manufacturer,
      model: this.brandConfig.model,
      firmwareVersion: this.brandConfig.firmwareVersion,
      serialNumber: this.brandConfig.serialNumber,
      hardwareId: this.brandConfig.hardwareId,
      deviceId: this.brandConfig.deviceId
    };
    
    this.httpPort = process.env.ONVIF_HTTP_PORT || 8080;
    this.httpAddress = '127.0.0.1';
    this.port = process.env.ONVIF_UDP_PORT || 3702;
    this.multicastAddress = '239.255.255.250';
    
    this.socket = dgram.createSocket('udp4');
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        //bind to the multicast port
        this.socket.bind(this.port, '0.0.0.0', () => {
          //join the multicast group
          this.socket.addMembership(this.multicastAddress);
          
          //set multicast TTL
          this.socket.setMulticastTTL(128);
          
          //set broadcast permissions
          this.socket.setBroadcast(true);
          

          resolve();
        });

        this.socket.on('message', (message, remote) => {
          this.handleMessage(message, remote);
        });
        this.socket.on('error', (err) => {
          reject(err);
        });


      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(message, remote) {
    try {
      const messageStr = message.toString();
      const sourceIp = remote.address;
      const sourcePort = remote.port;

      if (messageStr.includes('<wsd:Probe') || messageStr.includes('Probe')) {
        this.handleProbe(messageStr, remote);
      } else if (messageStr.includes('<wsd:Resolve') || messageStr.includes('Resolve')) {
        this.handleResolve(messageStr, remote);
      } else {
        //handle nmap and other UDP probes
        this.handleUDPProbe(messageStr, remote);
      }

    } catch (error) {
      // Silent error handling
    }
  }

  handleUDPProbe(messageStr, remote) {
    const sourceIp = remote.address;
    const sourcePort = remote.port;
     
    if (messageStr.length === 0 || messageStr.length < 10) {
      //empty packet or very short probe, respond with brand-specific fault pattern
      const response = this.createBrandSpecificFaultResponse();
      
      this.socket.send(response, sourcePort, sourceIp);
    } else {
      //unknown probe, respond with brand-specific ONVIF pattern
      const response = this.createBrandSpecificONVIFResponse();
      this.socket.send(response, sourcePort, sourceIp);
    }
  }

  createBrandSpecificFaultResponse() {
    //Create response matching the brand-specific fault pattern
    return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:SOAP-ENC="http://www.w3.org/2003/05/soap-encoding" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:d3="http://www.onvif.org/ver10/network/wsdl/RemoteDiscoveryBinding" xmlns:d4="http://www.onvif.org/ver10/network/wsdl/DiscoveryLookupBinding" xmlns:dn="http://www.onvif.org/ver10/network/wsdl"><SOAP-ENV:Body><SOAP-ENV:Fault><faultcode>SOAP-ENV:Client</faultcode><faultstring>No XML element tag</faultstring></SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
  }

  createBrandSpecificONVIFResponse() {
    //Create response matching the brand-specific ONVIF pattern
    return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:SOAP-ENC="http://www.w3.org/2003/05/soap-encoding" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:d3="http://www.onvif.org/ver10/network/wsdl/RemoteDiscoveryBinding" xmlns:d4="http://www.onvif.org/ver10/network/wsdl/DiscoveryLookupBinding" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
<SOAP-ENV:Body>
<d:ProbeMatches>
<d:ProbeMatch>
<wsa:EndpointReference>
<wsa:Address>urn:uuid:${this.deviceInfo.deviceId}</wsa:Address>
</wsa:EndpointReference>
<d:Types>dn:NetworkVideoTransmitter</d:Types>
<d:Scopes>onvif://www.onvif.org/type/video_encoder onvif://www.onvif.org/Profile/Streaming onvif://www.onvif.org/name/${this.deviceInfo.model}</d:Scopes>
<d:XAddrs>http://${this.httpAddress}:${this.httpPort}/onvif/device_service</d:XAddrs>
<d:MetadataVersion>1</d:MetadataVersion>
</d:ProbeMatch>
</d:ProbeMatches>
</SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
  }

  async handleProbe(probeMessage, remote) {
    try {
      const sourceIp = remote.address;
      const sourcePort = remote.port;
      const messageId = uuidv4();
      
      //extract MessageID from probe if present (handle different namespace prefixes)
      const messageIdMatch = probeMessage.match(/<[^:]*:MessageID[^>]*>([^<]+)<\/[^:]*:MessageID>/);
      const relatesTo = messageIdMatch ? messageIdMatch[1] : null;

      //create ProbeMatches response with brand-specific pattern
      const response = this.createProbeMatchesResponse(messageId, relatesTo);
      
      //send response back to the source
      this.socket.send(response, sourcePort, sourceIp);

    } catch (error) {
      // Silent error handling
    }
  }

  async handleResolve(resolveMessage, remote) { 
    try {
      const sourceIp = remote.address;
      const sourcePort = remote.port;
      const messageId = uuidv4();
      
      //extract MessageID from resolve if present
      const messageIdMatch = resolveMessage.match(/MessageID>([^<]+)<\/a:MessageID/);
      const relatesTo = messageIdMatch ? messageIdMatch[1] : null;

      //create ResolveMatches response with brand-specific pattern
      const response = this.createResolveMatchesResponse(messageId, relatesTo);
      
      //send response back to the source
      this.socket.send(response, sourcePort, sourceIp);

    } catch (error) {
      // Silent error handling
    }
  }

  createProbeMatchesResponse(messageId, relatesTo) {
    //use the provided relatesTo or generate a new one
    const relatesToId = relatesTo || `urn:uuid:${uuidv4()}`;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:SOAP-ENC="http://www.w3.org/2003/05/soap-encoding" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:d3="http://www.onvif.org/ver10/network/wsdl/RemoteDiscoveryBinding" xmlns:d4="http://www.onvif.org/ver10/network/wsdl/DiscoveryLookupBinding" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
<SOAP-ENV:Body>
<d:ProbeMatches>
<d:ProbeMatch>
<wsa:EndpointReference>
<wsa:Address>urn:uuid:${this.deviceInfo.deviceId}</wsa:Address>
</wsa:EndpointReference>
<d:Types>dn:NetworkVideoTransmitter</d:Types>
<d:Scopes>
onvif://www.onvif.org/type/video_encoder
onvif://www.onvif.org/Profile/Streaming
onvif://www.onvif.org/name/${this.deviceInfo.model}
onvif://www.onvif.org/location/name/${this.deviceInfo.manufacturer}Camera
onvif://www.onvif.org/hardware/${this.deviceInfo.hardwareId}
onvif://www.onvif.org/Profile/Device
onvif://www.onvif.org/Profile/Media
onvif://www.onvif.org/Profile/PTZ
</d:Scopes>
<d:XAddrs>http://${this.httpAddress}:${this.httpPort}/onvif/device_service</d:XAddrs>
<d:MetadataVersion>1</d:MetadataVersion>
</d:ProbeMatch>
</d:ProbeMatches>
</SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
  }

  createResolveMatchesResponse(messageId, relatesTo) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:SOAP-ENC="http://www.w3.org/2003/05/soap-encoding" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:d3="http://www.onvif.org/ver10/network/wsdl/RemoteDiscoveryBinding" xmlns:d4="http://www.onvif.org/ver10/network/wsdl/DiscoveryLookupBinding" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
<SOAP-ENV:Body>
<d:ResolveMatches>
<d:ResolveMatch>
<wsa:EndpointReference>
<wsa:Address>urn:uuid:${this.deviceInfo.deviceId}</wsa:Address>
</wsa:EndpointReference>
<d:Types>dn:NetworkVideoTransmitter</d:Types>
<d:Scopes>
onvif://www.onvif.org/type/video_encoder 
onvif://www.onvif.org/Profile/Streaming 
onvif://www.onvif.org/name/${this.deviceInfo.model}
onvif://www.onvif.org/location/name/${this.deviceInfo.manufacturer}Camera
</d:Scopes>
<d:XAddrs>http://${this.httpAddress}:${this.httpPort}/onvif/device_service</d:XAddrs>
<d:MetadataVersion>1</d:MetadataVersion>
</d:ResolveMatch>
</d:ResolveMatches>
</SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
  }

  stop() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

//start the UDP WS-Discovery service
if (require.main === module) {
  const wsDiscovery = new UDPWSDiscoveryService();
  wsDiscovery.start().catch(error => {
    process.exit(1);
  });

  //handle shutdown
  process.on('SIGINT', () => {
    wsDiscovery.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    wsDiscovery.stop();
    process.exit(0);
  });
}

module.exports = UDPWSDiscoveryService; 