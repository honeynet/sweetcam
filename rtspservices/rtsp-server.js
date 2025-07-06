const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');

class RTSPServer {
    constructor() {
        this.sessions = new Map(); 
        this.streams = new Map();
        this.sessionCounter = 0;
        this.setupStreams();
    }

    setupStreams() {
        this.streams.set('/stream', {
            name: 'Test stream',
            sdp: this.generateSDP(), //generate session description protocol
            rtpPort: 8002, //real time protocol port
            rtcpPort: 8003 
        });
    }

    generateSDP(name = 'Test stream') { 
        return `v=0\r
o=- 0 0 IN IP4 127.0.0.1\r
s=${name}\r
c=IN IP4 127.0.0.1\r
t=0 0\r
m=video 8002 RTP/AVP 26\r
a=rtpmap:26 JPEG/90000\r
a=control:trackID=1\r
a=framerate:5.0\r
a=quality:80\r
a=width:320\r
a=height:240\r
a=ptime:200\r
a=maxptime:200\r
`;
    }

    parseRTSPRequest(data) { 
        const lines = data.toString().split('\r\n');
        const [method, url, version] = lines[0].split(' ');
        const headers = {};
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) break;
            const colonIndex = lines[i].indexOf(':');
            if (colonIndex > 0) {
                const key = lines[i].substring(0, colonIndex).trim();
                const value = lines[i].substring(colonIndex + 1).trim();
                headers[key] = value;
            }
        }
        return { method, url, version, headers };
    }

    extractPath(url) {
        if (url.startsWith('rtsp://')) {
            try {
                const urlObj = new URL(url);
                let path = urlObj.pathname;
                if (path.includes('=')) {
                    path = path.split('=')[0];
                }
                return path;
            } catch (e) {
                let path = url.replace(/^rtsp:\/\/[^\/]+/, '');
                if (path.includes('=')) {
                    path = path.split('=')[0];
                }
                return path || '/';
            }
        }
        
        let path = url;
        path = path.split('?')[0];
        path = path.replace(/\/trackID=\d+$/, '');
        if (path.includes('=')) {
            path = path.split('=')[0];
        }
        return path;
    }

    parseTransport(transportHeader) {  //to extract client ports 
        if (!transportHeader) {
            return { rtpPort: 8000, rtcpPort: 8001 };
        }
        
        const parts = transportHeader.split(';');
        const clientPorts = parts.find(p => p.includes('client_port'));
        if (clientPorts) {
            const match = clientPorts.match(/client_port=(\d+)-(\d+)/);
            if (match) {
                return {
                    rtpPort: parseInt(match[1]), //match rtp port
                    rtcpPort: parseInt(match[2]) //match rtcp port
                };
            }
        }
        return { rtpPort: 8000, rtcpPort: 8001 }; //default ports
    }

    handleRequest(socket, data) { //main handler 
        console.log('Received:', data.toString().split('\r\n')[0]); 
        
        const dataStr = data.toString(); 
        if (!dataStr.includes('RTSP/1.0') && !dataStr.includes('RTSP/1.1')) {
            return;
        }
        
        try {
            const { method, url, headers } = this.parseRTSPRequest(data);
            const cseq = headers.CSeq || headers.Cseq || '1'; //command sequence
            
            if (method === 'OPTIONS') { //what methods are supported
                const response = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN\r\n\r\n`;
                socket.write(response);
                return;
            }
            
            const path = this.extractPath(url);
            let stream = this.streams.get(path);
            
            if (!stream && (method === 'SETUP' || method === 'PLAY' || method === 'TEARDOWN')) {
                for (const [streamPath, streamData] of this.streams) {
                    if (path.startsWith(streamPath) || streamPath.startsWith(path)) { //if stream is not found, try to find a partial match
                        stream = streamData;
                        break;
                    }
                }
            }

            if (!stream && method !== 'DESCRIBE') {
                socket.write(`RTSP/1.0 404 Not Found\r\nCSeq: ${cseq}\r\n\r\n`);
                return;
            }

            switch (method) {
                case 'DESCRIBE': //respond with SDP , describes format codec, framerate
                    if (!stream) {
                        socket.write(`RTSP/1.0 404 Not Found\r\nCSeq: ${cseq}\r\n\r\n`);
                        return;
                    }
                    const sdpResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nContent-Type: application/sdp\r\nContent-Length: ${stream.sdp.length}\r\n\r\n${stream.sdp}`;
                    socket.write(sdpResponse);
                    break;
                    
                case 'SETUP':
                    this.sessionCounter++;
                    const sessionId = this.sessionCounter.toString();
                    const transport = this.parseTransport(headers.Transport || '');
                    
                    this.sessions.set(sessionId, { //creates a new session object
                        path: '/stream',
                        state: 'setup',
                        rtpPort: stream.rtpPort,
                        clientRtpPort: transport.rtpPort,
                        clientRtcpPort: transport.rtcpPort,
                        clientAddress: socket.remoteAddress,
                        socket: socket
                    });

                    const setupResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nTransport: RTP/AVP;unicast;client_port=${transport.rtpPort}-${transport.rtcpPort};server_port=${stream.rtpPort}-${stream.rtcpPort}\r\nSession: ${sessionId}\r\n\r\n`;
                    socket.write(setupResponse);
                    break;
                    
                case 'PLAY':
                    const sessionId2 = headers.Session;
                    const session = this.sessions.get(sessionId2);
                    if (!session) {
                        socket.write(`RTSP/1.0 454 Session Not Found\r\nCSeq: ${cseq}\r\n\r\n`);
                        return;
                    }
                    session.state = 'playing';
                    const playResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nSession: ${sessionId2}\r\nRange: npt=0.000-\r\nRTP-Info: url=rtsp://127.0.0.1:554${session.path};seq=0;rtptime=0\r\n\r\n`;
                    socket.write(playResponse);
                    this.startRTPStream(session);
                    break;
                    
                case 'TEARDOWN':
                    const sessionId3 = headers.Session;
                    if (sessionId3 && this.sessions.has(sessionId3)) {
                        const sess = this.sessions.get(sessionId3);
                        if (sess.rtpInterval) {
                            clearInterval(sess.rtpInterval);
                        }
                        this.sessions.delete(sessionId3);
                    }
                    socket.write(`RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nSession: ${sessionId3}\r\n\r\n`);
                    break;
                    
                default:
                    socket.write(`RTSP/1.0 501 Not Implemented\r\nCSeq: ${cseq}\r\n\r\n`);
            }
        } catch (error) {
            console.error('Error handling request:', error);
            socket.write(`RTSP/1.0 500 Internal Server Error\r\nCSeq: 1\r\n\r\n`);
        }
    }

    startRTPStream(session) {
        const rtp = dgram.createSocket('udp4'); //create udp socker for sending rtp packets 
        let seq = 0;
        const startTime = process.hrtime();
        
        //load the test image file
        let jpeg;
        try {
            const imagePath = path.join(__dirname, 'test.jpg');
            jpeg = fs.readFileSync(imagePath);
            console.log(`Loaded test image: test.jpg (${jpeg.length} bytes)`);
        } catch (e) {
            console.log(`Could not load test.jpg: ${e.message}`);
            console.log('Please ensure test.jpg is present in the container. Exiting...');
            rtp.close();
            return;
        }

        console.log(`Starting RTP stream to ${session.clientAddress}:${session.clientRtpPort}`);
        console.log(`JPEG size: ${jpeg.length} bytes`);

        const frameRate = 5;
        const frameInterval = 1000 / frameRate; //200 ms between frames
        let nextFrameTime = Date.now();

        const sendFrame = () => {
            if (session.state !== 'playing') {
                rtp.close();
                return;
            }

            //calculate timestamp based on actual elapsed time
            const elapsed = process.hrtime(startTime);
            const timestamp = Math.floor(elapsed[0] * 90000 + elapsed[1] / (1000000000/90000));

            //create RTP header (12 bytes)
            const rtpHeader = Buffer.alloc(12);
            rtpHeader[0] = 0x80; // Version=2, Padding=0, eXtension=0, CC=0 
            rtpHeader[1] = 0x1A; // M=0, PT=26 (JPEG), no mark bit for consistent timing
            rtpHeader.writeUInt16BE(seq & 0xFFFF, 2);
            rtpHeader.writeUInt32BE(timestamp, 4);
            rtpHeader.writeUInt32BE(0x12345678, 8); //SSRC

            //JPEG RTP payload header (8 bytes)
            const jpegHeader = Buffer.alloc(8);
            jpegHeader[0] = 0; //type-specific
            jpegHeader[1] = 0; //fragment offset
            jpegHeader[2] = 0; //fragment offset
            jpegHeader[3] = 0; //fragment fffset
            jpegHeader[4] = 0; //type (0 = YUV422)
            jpegHeader[5] = 80; // Q factor
            jpegHeader[6] = Math.ceil(320 / 8); //width in 8x8 blocks
            jpegHeader[7] = Math.ceil(240 / 8); //height in 8x8 blocks

            //build the complete RTP packet (combine RTP header, JPEG header, JPEG data)
            const rtpPacket = Buffer.concat([rtpHeader, jpegHeader, jpeg]);

            //send the packet
            rtp.send(rtpPacket, 0, rtpPacket.length, session.clientRtpPort, session.clientAddress || '127.0.0.1', (err) => {
                if (err) {
                    console.error('RTP send error:', err);
                } else if (seq % 10 === 0) {
                    console.log(`Frame ${seq}, timestamp: ${timestamp}, packet size: ${rtpPacket.length}`);
                }
            });

            seq++; //increment seqence number for the next packet
            
            //schedule next frame with precise timing
            const now = Date.now();
            const delay = Math.max(0, nextFrameTime - now);
            nextFrameTime += frameInterval;
            
            setTimeout(sendFrame, delay);
        };

        //start the stream
        sendFrame();
    }
}

const rtsp = new RTSPServer();
const server = net.createServer(socket => {
    console.log('RTSP client connected from', socket.remoteAddress);
    
    socket.on('data', data => {
        rtsp.handleRequest(socket, data);
    });
    
    socket.on('error', err => {
        console.error('Socket error:', err);
    });
    
    socket.on('close', () => {
        console.log('RTSP client disconnected');
        for (const [sessionId, session] of rtsp.sessions) {
            if (session.socket === socket) {
                rtsp.sessions.delete(sessionId);
            }
        }
    });
});

server.listen(554, '0.0.0.0', () => {
    console.log('RTSP server listening on rtsp://0.0.0.0:554/stream');
    console.log('Test with: rtsp://localhost:554/stream');
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});