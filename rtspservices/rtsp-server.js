const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');

class RTSPServer {
    constructor() {
        this.sessions = new Map();//active streaming sessions
        this.streams = new Map();//available video streams
        this.sessionCounter = 0;//unique session id counter
        this.setupStreams();
    }

    /**
     *initialize available video streams
     */
    setupStreams() {
        this.streams.set('/stream', {
            name: 'Video stream',
            sdp: this.generateSDP(),
            rtpPort: 8002,//rtp data port
            rtcpPort: 8003 //rtcp control port
        });
    }

    /**
     * generate session description protocol (sdp) for the video stream
     *tells clients about the video format, resolution and frame rate
     */
    generateSDP(name = 'Video stream') { 
        return `v=0\r
o=- 0 0 IN IP4 127.0.0.1\r
s=${name}\r
c=IN IP4 127.0.0.1\r
t=0 0\r
m=video 8002 RTP/AVP 26\r
a=rtpmap:26 JPEG/90000\r
a=framerate:15.0\r
a=framesize:26 160-120\r
a=control:trackID=1\r
`;
    }

    /**
     *parse rtsp request headers and extract method, URL and headers
     */
    parseRTSPRequest(data) { 
        const lines = data.toString().split('\r\n');
        const [method, url, version] = lines[0].split(' ');
        const headers = {};
        
        //parse headers
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

    /**
     * extract stream path from RTSP URL
     * handles various URL formats and removes track parameters
     */
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
        
        //handle relative URLs
        let path = url;
        path = path.split('?')[0];
        path = path.replace(/\/trackID=\d+$/, '');
        if (path.includes('=')) {
            path = path.split('=')[0];
        }
        return path;
    }

    /**
     *parse transport header to get client rtp/rtcp ports
     */
    parseTransport(transportHeader) {
        if (!transportHeader) {
            return { rtpPort: 8000, rtcpPort: 8001 };
        }
        
        const parts = transportHeader.split(';');
        const clientPorts = parts.find(p => p.includes('client_port'));
        if (clientPorts) {
            const match = clientPorts.match(/client_port=(\d+)-(\d+)/);
            if (match) {
                return {
                    rtpPort: parseInt(match[1]),
                    rtcpPort: parseInt(match[2])
                };
            }
        }
        return { rtpPort: 8000, rtcpPort: 8001 };
    }

    /**
     *handle rtsp requests (options, describe, setup, play, teardown)
     */
    handleRequest(socket, data) {
        const dataStr = data.toString(); 
        
        //validate rtsp request
        if (!dataStr.includes('RTSP/1.0') && !dataStr.includes('RTSP/1.1')) {
            return;
        }
        
        try {
            const { method, url, headers } = this.parseRTSPRequest(data);
            const cseq = headers.CSeq || headers.Cseq || '1';
            
            //handle options request (client capabilities)
            if (method === 'OPTIONS') {
                const response = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN\r\n\r\n`;
                socket.write(response);
                return;
            }
            
            //find the requested stream
            const path = this.extractPath(url);
            let stream = this.streams.get(path);
            
            //handle track specific requests
            if (!stream && (method === 'SETUP' || method === 'PLAY' || method === 'TEARDOWN')) {
                for (const [streamPath, streamData] of this.streams) {
                    if (path.startsWith(streamPath) || streamPath.startsWith(path)) {
                        stream = streamData;
                        break;
                    }
                }
            }

            if (!stream && method !== 'DESCRIBE') {
                socket.write(`RTSP/1.0 404 not found\r\nCSeq: ${cseq}\r\n\r\n`);
                return;
            }

            //handle different rtsp methods
            switch (method) {
                case 'DESCRIBE':
                    //send stream description (sdp)
                    if (!stream) {
                        socket.write(`RTSP/1.0 404 not found\r\nCSeq: ${cseq}\r\n\r\n`);
                        return;
                    }
                    const sdpResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nContent-Type: application/sdp\r\nContent-Length: ${stream.sdp.length}\r\n\r\n${stream.sdp}`;
                    socket.write(sdpResponse);
                    break;
                    
                case 'SETUP':
                    //setup streaming session
                    this.sessionCounter++;
                    const sessionId = this.sessionCounter.toString();
                    const transport = this.parseTransport(headers.Transport || '');
                    
                    //create new session
                    this.sessions.set(sessionId, {
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
                    //start video streaming
                    const sessionId2 = headers.Session;
                    const session = this.sessions.get(sessionId2);
                    if (!session) {
                        socket.write(`RTSP/1.0 454 session not found\r\nCSeq: ${cseq}\r\n\r\n`);
                        return;
                    }
                    
                    //initialize session for streaming
                    session.state = 'playing';
                    const nowMs = Date.now();
                    session.startTimeMs = nowMs;
                    session.frameNumber = 0;
                    session.lastSeq = 1;
                    session.rtpStartTimestamp = Math.floor(nowMs / 1000) % 1000000;
                    session.lastTimestamp = session.rtpStartTimestamp;

                    const rtpStart = session.rtpStartTimestamp;
                    const nptStart = 0.0;
                    const playResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nSession: ${sessionId2}\r\nRange: npt=${nptStart.toFixed(3)}-\r\nRTP-Info: url=rtsp://127.0.0.1:554${session.path}/trackID=1;seq=${session.lastSeq};rtptime=${rtpStart}\r\n\r\n`;
                    socket.write(playResponse);

                    //start rtp streaming
                    this.startRTPStream(session);
                    break;
                    
                case 'TEARDOWN':
                    //stop streaming and cleanup session
                    const sessionId3 = headers.Session;
                    if (sessionId3 && this.sessions.has(sessionId3)) {
                        const sess = this.sessions.get(sessionId3);
                        
                        //mark session as stopping
                        sess.state = 'stopping';
                        
                        //stop streaming intervals
                        if (sess.rtpInterval) {
                            clearInterval(sess.rtpInterval);
                            sess.rtpInterval = null;
                        }
                        if (sess.rtcpInterval) {
                            clearInterval(sess.rtcpInterval);
                            sess.rtcpInterval = null;
                        }
                        
                        //close sockets after delay
                        setTimeout(() => {
                            if (sess.rtpSocket) {
                                sess.rtpSocket.close();
                            }
                            if (sess.rtcpSocket) {
                                sess.rtcpSocket.close();
                            }
                            this.sessions.delete(sessionId3);
                            console.log(`Session ${sessionId3} closed`);
                        }, 50);
                    }
                    socket.write(`RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nSession: ${sessionId3}\r\n\r\n`);
                    break;
                    
                default:
                    socket.write(`RTSP/1.0 501 not implemented\r\nCSeq: ${cseq}\r\n\r\n`);
            }
        } catch (error) {
            console.error('Error handling request:', error);
            socket.write(`RTSP/1.0 500 internal server error\r\nCSeq: 1\r\n\r\n`);
        }
    }

    /**
     * start rtp video streaming for a session
     * sends jpeg frames at regular intervals
     */
    startRTPStream(session) {
        //create udp sockets for rtp and rtcp
        const rtp = dgram.createSocket('udp4');
        const rtcp = dgram.createSocket('udp4');
        
        //streaming parameters
        const ssrc = 0x12345678;  //synchronization source identifier
        const clockRate = 90000;  //90khz clock rate for video
        const frameRate = 15;     //15 fps for stability
        const timestampIncrement = clockRate / frameRate; //6000
        const frameInterval = 1000 / frameRate; //~66.67ms between frames
        
        //load test jpeg image
        let jpeg;
        try {
            const imagePath = path.join(__dirname, 'img.jpg');
            jpeg = fs.readFileSync(imagePath);
        } catch (e) {
            console.log(`could not load: ${e.message}`);
            rtp.close();
            rtcp.close();
            return;
        }

        //store sockets in session for cleanup
        session.rtpSocket = rtp;
        session.rtcpSocket = rtcp;
        
        //add error handlers
        rtp.on('error', (err) => {
            if (session.state !== 'stopping') {
                console.error('RTP socket error:', err.message);
            }
        });
        
        rtcp.on('error', (err) => {
            if (session.state !== 'stopping') {
                console.error('RTCP socket error:', err.message);
            }
        });
        
        //initialize streaming counters
        let seq = session.lastSeq || 0;
        let packetsSent = 0;
        let octetsSent = 0;
        const streamStartTime = Date.now();
        let rtpTimestamp = session.lastTimestamp || 0;

        /**
         *send a single jpeg frame via rtp
         */
        const sendFrame = () => {
            //check if session is still active
            if (session.state !== 'playing') {
                if (session.rtpInterval) {
                    clearInterval(session.rtpInterval);
                }
                if (session.state === 'stopping') {
                    return;
                }
                rtp.close();
                rtcp.close();
                return;
            }

            const now = Date.now();
            const elapsedMs = now - streamStartTime;
            
            //create rtp header (12 bytes)
            const rtpHeader = Buffer.alloc(12);
            rtpHeader[0] = 0x80;//version=2, padding=0, extension=0, cc=0
            rtpHeader[1] = 0x9A;//m=1 (mark bit for jpeg), pt=26 (jpeg)
            rtpHeader.writeUInt16BE(seq & 0xFFFF, 2);//sequence number
            rtpHeader.writeUInt32BE(rtpTimestamp & 0xFFFFFFFF, 4);//timestamp
            rtpHeader.writeUInt32BE(ssrc, 8);//ssrc

            //jpeg rtp payload header (8 bytes)
            const jpegHeader = Buffer.alloc(8);
            jpegHeader[0] = 0;//type specific
            jpegHeader[1] = 0;//fragment offset (24 bit) high
            jpegHeader[2] = 0;//fragment offset middle
            jpegHeader[3] = 0;//fragment offset low
            jpegHeader[4] = 0;//type (0 = 4:2:2)
            jpegHeader[5] = 80;//q factor
            jpegHeader[6] = 160 / 8;//width in 8 pixel blocks (160 pixels)
            jpegHeader[7] = 120 / 8;//height in 8 pixel blocks (120 pixels)

            //build complete rtp packet
            const rtpPacket = Buffer.concat([rtpHeader, jpegHeader, jpeg]);

            //send rtp packet to client
            rtp.send(rtpPacket, 0, rtpPacket.length, session.clientRtpPort, session.clientAddress || '127.0.0.1', (err) => {
                if (err) {
                    if (session.state !== 'stopping') {
                        console.error('RTP send error:', err);
                    }
                } else {
                    packetsSent++;
                    octetsSent += rtpPacket.length;
                    
                    //log progress every second
                    if (seq % 15 === 0) {
                        const streamSeconds = Math.floor(elapsedMs / 1000);
                        const expectedTimestamp = streamSeconds * clockRate;
                        console.log(`Real time: ${streamSeconds}s, Frame: ${seq}, RTP timestamp: ${rtpTimestamp}, Expected: ${expectedTimestamp}`);
                    }
                }
            });

            //update session state
            seq++;
            session.frameNumber = seq;
            session.lastSeq = seq;
            session.lastTimestamp = rtpTimestamp;
            session.packetsSent = packetsSent;
            session.octetsSent = octetsSent;
            session.streamStartTime = streamStartTime;
            
            //increment timestamp for next frame
            rtpTimestamp += timestampIncrement;
        };

        /**
         *send rtcp sender report for synchronization
         */
        const sendRTCP = () => {
            if (session.state !== 'playing') {
                return;
            }

            const now = Date.now();
            const ntpSec = Math.floor(now / 1000) + 2208988800;  //ntp seconds since 1900
            const ntpFrac = Math.floor((now % 1000) * 4294967.296); //ntp fractional seconds
            const currentRtpTimestamp = session.lastTimestamp || 0;

            //create rtcp sender report (sr)
            const rtcpSR = Buffer.alloc(28);
            rtcpSR[0] = 0x80;//v=2, p=0, rc=0
            rtcpSR[1] = 200;//pt=200 (sr)
            rtcpSR.writeUInt16BE(6, 2);//length = 6 (28 bytes / 4 - 1)
            rtcpSR.writeUInt32BE(ssrc, 4);//ssrc
            rtcpSR.writeUInt32BE(ntpSec, 8);//ntp timestamp (seconds)
            rtcpSR.writeUInt32BE(ntpFrac, 12);//ntp timestamp (fraction)
            rtcpSR.writeUInt32BE(currentRtpTimestamp & 0xFFFFFFFF, 16);//rtp timestamp
            rtcpSR.writeUInt32BE(session.packetsSent || 0, 20);//packet count
            rtcpSR.writeUInt32BE(session.octetsSent || 0, 24);//octet count

            //send rtcp packet
            rtcp.send(rtcpSR, 0, rtcpSR.length, session.clientRtcpPort, session.clientAddress || '127.0.0.1', (err) => {
                if (err) {
                    console.error('RTCP send error:', err);
                } else {
                    const elapsedMs = now - streamStartTime;
                    console.log(`RTCP SR sent - RTP timestamp: ${currentRtpTimestamp}, elapsed: ${elapsedMs}ms`);
                }
            });
        };

        //start streaming
        sendRTCP();//send first rtcp
        sendFrame();//send first frame
        //schedule regular frame transmission
        session.rtpInterval = setInterval(sendFrame, frameInterval);
        //schedule rtcp reports
        session.rtcpInterval = setInterval(sendRTCP, 1000);
    }
}

//create rtsp server instance
const rtsp = new RTSPServer();

//create tcp server for rtsp connections
const server = net.createServer(socket => {
    socket.on('data', data => {
        rtsp.handleRequest(socket, data);
    });    
    socket.on('error', err => {
        console.error('socket error:', err);
    });
    
    //handle client disconnection
    socket.on('close', () => {
        //clean up any sessions associated with this socket
        for (const [sessionId, session] of rtsp.sessions) {
            if (session.socket === socket) {
                session.state = 'stopping';
                setTimeout(() => {
                    if (session.rtpSocket) session.rtpSocket.close();
                    if (session.rtcpSocket) session.rtcpSocket.close();
                    if (session.rtpInterval) clearInterval(session.rtpInterval);
                    if (session.rtcpInterval) clearInterval(session.rtcpInterval);
                    rtsp.sessions.delete(sessionId);
                    console.log(`session ${sessionId} cleaned up`);
                }, 100);
            }
        }
    });
});

//start server
server.listen(554, '0.0.0.0', () => {
    console.log('RTSP server listening on rtsp://0.0.0.0:554/stream');
    console.log('Test with: rtsp://localhost:554/stream');
});

//graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});