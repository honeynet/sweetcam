const dgram = require('dgram');
const { v4: uuidv4 } = require('uuid');

class UDPWSDiscoveryService { //key properties
  constructor() {
    this.deviceInfo = {
      manufacturer: 'Original Equipment Manufacturer',
      model: 'DK-49382947',
      firmwareVersion: '1.0.0',
      serialNumber: '4495375829',
      hardwareId: '4495375829',
      deviceId: uuidv4()
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

  handleUDPProbe(messageStr, remote) { ///for general UDP probes
    const sourceIp = remote.address;
    const sourcePort = remote.port;
     
    if (messageStr.length === 0 || messageStr.length < 10) {
      //empty packet or very short probe, respond with a minimal WS-Discovery response
      const response = this.createMinimalResponse();
      
      this.socket.send(response, sourcePort, sourceIp);
    } else {
      //unknown probe, still respond to show port is open
      const response = this.createMinimalResponse();
      this.socket.send(response, sourcePort, sourceIp);
    }
  }

  createMinimalResponse() {
    //create a minimal WS-Discovery response that will satisfy nmap
    return `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"
              xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
              xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery">
  <env:Header>
    <wsa:MessageID>urn:uuid:${uuidv4()}</wsa:MessageID>
    <wsa:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action>
  </env:Header>
  <env:Body>
    <wsd:ProbeMatches/>
  </env:Body>
</env:Envelope>`;
  }

  async handleProbe(probeMessage, remote) { //network video transmitter, supporting video encoding and streaming, has an ONVIF device services
    try {
      const sourceIp = remote.address;
      const sourcePort = remote.port;
      const messageId = uuidv4();
      
      //extract MessageID from probe if present (handle different namespace prefixes)
      const messageIdMatch = probeMessage.match(/<[^:]*:MessageID[^>]*>([^<]+)<\/[^:]*:MessageID>/);
      const relatesTo = messageIdMatch ? messageIdMatch[1] : null;

      //create ProbeMatches response
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

      //create ResolveMatches response
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
<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"
              xmlns:dn="http://www.onvif.org/ver10/network/wsdl"
              xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"
              xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
              xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <env:Header>
    <wsa:MessageID>urn:uuid:${messageId}</wsa:MessageID>
    <wsa:RelatesTo>${relatesToId}</wsa:RelatesTo>
    <wsa:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action>
  </env:Header>
  <env:Body>
    <wsd:ProbeMatches>
      <wsd:ProbeMatch>
        <wsa:EndpointReference>
          <wsa:Address>urn:uuid:${this.deviceInfo.deviceId}</wsa:Address>
        </wsa:EndpointReference>
        <wsd:Types>dn:NetworkVideoTransmitter tds:Device</wsd:Types>
        <wsd:Scopes>
          onvif://www.onvif.org/type/video_encoder
          onvif://www.onvif.org/Profile/Streaming
          onvif://www.onvif.org/name/${this.deviceInfo.model}
          onvif://www.onvif.org/location/name/ONVIFCamera
          onvif://www.onvif.org/hardware/${this.deviceInfo.hardwareId}
          onvif://www.onvif.org/Profile/Device
        </wsd:Scopes>
        <wsd:XAddrs>http://${this.httpAddress}:${this.httpPort}/onvif/device_service</wsd:XAddrs>
        <wsd:MetadataVersion>1</wsd:MetadataVersion>
      </wsd:ProbeMatch>
    </wsd:ProbeMatches>
  </env:Body>
</env:Envelope>`;
  }

  createResolveMatchesResponse(messageId, relatesTo) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"
              xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
              xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"
              xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
              xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <env:Header>
    <wsa:MessageID>urn:uuid:${messageId}</wsa:MessageID>
    ${relatesTo ? `<wsa:RelatesTo>${relatesTo}</wsa:RelatesTo>` : ''}
    <wsa:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/ResolveMatches</wsa:Action>
  </env:Header>
  <env:Body>
    <wsd:ResolveMatches>
      <wsd:ResolveMatch>
        <wsa:EndpointReference>
          <wsa:Address>urn:uuid:${this.deviceInfo.deviceId}</wsa:Address>
        </wsa:EndpointReference>
        <wsd:Types>dn:NetworkVideoTransmitter tds:Device</wsd:Types>
        <wsd:Scopes>
          onvif://www.onvif.org/type/video_encoder 
          onvif://www.onvif.org/Profile/Streaming 
          onvif://www.onvif.org/name/${this.deviceInfo.model}
          onvif://www.onvif.org/location/name/ONVIFCamera
        </wsd:Scopes>
        <wsd:XAddrs>http://${this.httpAddress}:${this.httpPort}/onvif/device_service</wsd:XAddrs>
        <wsd:MetadataVersion>1</wsd:MetadataVersion>
      </wsd:ResolveMatch>
    </wsd:ResolveMatches>
  </env:Body>
</env:Envelope>`;
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