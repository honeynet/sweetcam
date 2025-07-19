const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const dbConfig = require('./config/db-config.js');

//database configuration for mysql2 pool
const poolConfig = {
    host: dbConfig.HOST,
    user: dbConfig.USER,
    password: dbConfig.PASSWORD,
    database: dbConfig.DB,
    port: dbConfig.PORT,
    waitForConnections: true,
    connectionLimit: dbConfig.pool.max,
    queueLimit: 0
};

//create database connection pool
const pool = mysql.createPool(poolConfig);

//test database connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Failed to connect to database:', err.message);
        console.log('RTSP server will start but authentication will fail until database is available');
    } else {
        console.log('Database connection successful');
        connection.release();
    }
});

//auth helper functions
function parseAuthorization(headerLine) {
    if (!headerLine) return null;
    const match = headerLine.match(/^Authorization:\s+Basic\s+(.+)$/i);
    if (!match) return null;

    try {
        const credentials = Buffer.from(match[1], 'base64').toString();
        const [username, password] = credentials.split(':');
        return { username, password };
    } catch (error) {
        console.error('Error parsing authorization header:', error);
        return null;
    }
}

function authenticateUser(username, password) {
    return new Promise((resolve) => {
        //convert username to lowercase for case-insensitive comparison
        const lowerUsername = username.toLowerCase();
        
        //query the database for the user
        const query = 'SELECT name, passwordHash FROM users WHERE LOWER(name) = ?';
        
        pool.query(query, [lowerUsername], (error, results) => {
            if (error) {
                console.error('Database query error:', error);
                console.log(`Database authentication failed for user: ${username} - database connection error`);
                resolve(false);
                return;
            }
            
            if (results.length === 0) {
                console.log(`User not found: ${username}`);
                resolve(false);
                return;
            }
            
            const user = results[0];
            
            //use bcrypt to compare the provided password with the stored hash
            try {
                const isValid = bcrypt.compareSync(password, user.passwordHash);
                if (isValid) {
                    console.log(`Database authentication successful for user: ${username}`);
                    resolve(true);
                } else {
                    console.log(`Invalid password for user: ${username}`);
                    resolve(false);
                }
            } catch (bcryptError) {
                console.error('Bcrypt comparison error:', bcryptError);
                resolve(false);
            }
        });
    });
}


class RTSPServer {
    constructor() {
        this.sessions = new Map(); 
        this.streams = new Map();
        this.sessionCounter = 0;
        this.setupStreams();
    }

    setupStreams() {
        this.streams.set('/stream', {
            name: 'Video stream',
            rtpPort: 8002,
            rtcpPort: 8003 
        });
    }

    generateSDP(name = 'Video stream', serverAddress = '127.0.0.1') { 
        return `v=0\r
o=- 0 0 IN IP4 ${serverAddress}\r
s=${name}\r
c=IN IP4 ${serverAddress}\r
t=0 0\r
a=control:*\r
m=video 8002 RTP/AVP 26\r
a=rtpmap:26 JPEG/90000\r
a=framerate:30.0\r
a=control:trackID=1\r
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

    parseTransport(transportHeader) {
        console.log('Transport header received:', transportHeader);
        
        if (!transportHeader) {
            return { rtpPort: 8000, rtcpPort: 8001 };
        }
        
        const parts = transportHeader.split(';');
        console.log('Transport parts:', parts);
        
        const clientPorts = parts.find(p => p.includes('client_port'));
        if (clientPorts) {
            const match = clientPorts.match(/client_port=(\d+)-(\d+)/);
            if (match) {
                const rtpPort = parseInt(match[1]);
                const rtcpPort = parseInt(match[2]);
                console.log(`Parsed client ports: RTP=${rtpPort}, RTCP=${rtcpPort}`);
                return {
                    rtpPort: rtpPort,
                    rtcpPort: rtcpPort
                };
            }
        }
        
        // Fallback to default ports
        console.log('Using default ports: RTP=8000, RTCP=8001');
        return { rtpPort: 8000, rtcpPort: 8001 };
    }

    async handleRequest(socket, data) {
        console.log('Received:', data.toString().split('\r\n')[0]); 
        
        const dataStr = data.toString(); 
        if (!dataStr.includes('RTSP/1.0') && !dataStr.includes('RTSP/1.1')) {
            return;
        }
        
        try {
            const { method, url, headers } = this.parseRTSPRequest(data);
            const cseq = headers.CSeq || headers.Cseq || '1';
            const sessionId = headers.Session;
            
            //check if we have an authenticated session
            let authenticatedSession = null;
            if (sessionId && this.sessions.has(sessionId)) {
                authenticatedSession = this.sessions.get(sessionId);
            }
            
            //authentication check (only for DESCRIBE and later methods)
            if (method === 'DESCRIBE' || method === 'SETUP' || method === 'PLAY' || method === 'PAUSE' || method === 'TEARDOWN') {
                //if we have an authenticated session, skip authentication
                if (authenticatedSession && authenticatedSession.authenticated) {
                    console.log(`Using authenticated session: ${sessionId}`);
                } else {
                    let credentials = null;
                    
                    //first try to get credentials from Authorization header
                    const authLine = dataStr.split('\r\n').find(line => line.startsWith('Authorization:'));
                    if (authLine) {
                        credentials = parseAuthorization(authLine);
                    }
                    
                    //if no Authorization header, try to extract from URL
                    if (!credentials && url.includes('@')) {
                        try {
                            //handle both cases: with path and without path
                            let urlMatch = url.match(/rtsp:\/\/([^:]+):([^@]+)@([^\/]+)(\/.*)/);
                            if (!urlMatch) {
                                //try without path (just root)
                                urlMatch = url.match(/rtsp:\/\/([^:]+):([^@]+)@([^\/]+)/);
                            }
                            if (urlMatch) {
                                credentials = {
                                    username: urlMatch[1],
                                    password: urlMatch[2]
                                };
                                console.log(`Extracted credentials from URL: ${credentials.username}`);
                            }
                        } catch (e) {
                            console.error('Error parsing URL credentials:', e);
                        }
                    }
                    
                    if (!credentials) {
                        console.log('No credentials provided');
                        socket.write(
                            `RTSP/1.0 401 Unauthorized\r\n` +
                            `CSeq: ${cseq}\r\n` +
                            `WWW-Authenticate: Basic realm="RTSP Server"\r\n\r\n`
                        );
                        return;
                    }

                    try {
                        const isValid = await authenticateUser(credentials.username, credentials.password);
                        if (!isValid) {
                            console.log(`Invalid credentials for user: ${credentials.username}`);
                            socket.write(
                                `RTSP/1.0 401 Unauthorized\r\n` +
                                `CSeq: ${cseq}\r\n` +
                                `WWW-Authenticate: Basic realm="RTSP Server"\r\n\r\n`
                            );
                            return;
                        }
                        console.log(`Authenticated user: ${credentials.username}`);
                        
                        //mark session as authenticated if this is a SETUP request
                        if (method === 'SETUP' && sessionId) {
                            if (this.sessions.has(sessionId)) {
                                this.sessions.get(sessionId).authenticated = true;
                                this.sessions.get(sessionId).username = credentials.username;
                            }
                        }
                    } catch (err) {
                        console.error('Authentication error:', err);
                        socket.write(
                            `RTSP/1.0 500 Internal Server Error\r\n` +
                            `CSeq: ${cseq}\r\n\r\n`
                        );
                        return;
                    }
                }
            }
            
            if (method === 'OPTIONS') {
                const response = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n`;
                socket.write(response);
                return;
            }
            
            let path = this.extractPath(url);
            console.log(`Extracted path: "${path}" from URL: "${url}"`);
            
            //if they hit the root, and you only have one stream, map it
            if (path === '/' && this.streams.size === 1) {
                const streamPath = Array.from(this.streams.keys())[0];
                console.log(`Redirecting root request to ${streamPath}`);
                path = streamPath;
            }
            
            let stream = this.streams.get(path);
            
            if (!stream && (method === 'SETUP' || method === 'PLAY' || method === 'PAUSE' || method === 'TEARDOWN')) {
                for (const [streamPath, streamData] of this.streams) {
                    if (path.startsWith(streamPath) || streamPath.startsWith(path)) {
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
                case 'DESCRIBE':
                    if (!stream) {
                        socket.write(`RTSP/1.0 404 Not Found\r\nCSeq: ${cseq}\r\n\r\n`);
                        return;
                    }
                    //generate SDP with proper server address
                    const serverAddress = socket.localAddress || '127.0.0.1';
                    const sdp = this.generateSDP(stream.name, serverAddress);
                    const baseURL = `rtsp://${serverAddress}:554${path}/`;
                    const sdpResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nContent-Type: application/sdp\r\nContent-Base: ${baseURL}\r\nContent-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`;
                    socket.write(sdpResponse);
                    break;
                    
                case 'SETUP':
                    this.sessionCounter++;
                    const sessionId2 = this.sessionCounter.toString();
                    const transport = this.parseTransport(headers.Transport || '');
                    
                    //use server's RTP/RTCP ports (8002/8003) for server_port
                    const serverRtpPort = 8002;
                    const serverRtcpPort = 8003;
                    
                    this.sessions.set(sessionId2, {
                        path: '/stream',
                        state: 'setup',
                        rtpPort: serverRtpPort,
                        clientRtpPort: transport.rtpPort,
                        clientRtcpPort: transport.rtcpPort,
                        clientAddress: socket.remoteAddress,
                        socket: socket,
                        authenticated: true //mark session as authenticated
                    });

                    const setupResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nTransport: RTP/AVP;unicast;client_port=${transport.rtpPort}-${transport.rtcpPort};server_port=${serverRtpPort}-${serverRtcpPort}\r\nSession: ${sessionId2}\r\n\r\n`;
                    console.log('SETUP response:', setupResponse);
                    socket.write(setupResponse);
                    break;
                    
                case 'PLAY':
                    const sessionId3 = headers.Session;
                    const session = this.sessions.get(sessionId3);
                    if (!session) {
                        socket.write(`RTSP/1.0 454 session not found\r\nCSeq: ${cseq}\r\n\r\n`);
                        return;
                    }
                    
                    //check if resuming from pause
                    const isResuming = session.state === 'paused';
                    session.state = 'playing';

                    if (!isResuming) {
                        //new play,initialize timestamps
                        const nowMs = Date.now();
                        session.startTimeMs = nowMs;
                        session.frameNumber = 0;
                        session.lastSeq = 1; //start from 1, not random
                        session.rtpStartTimestamp = Math.floor(nowMs / 1000) % 1000000; //keep it reasonable
                        session.lastTimestamp = session.rtpStartTimestamp;
                    } else {
                        //resuming from pause, update start time but keep existing sequence and timestamp
                        session.startTimeMs = Date.now();
                        console.log(`Resuming stream for session ${sessionId3} from sequence ${session.lastSeq}`);
                    }

                    const rtpStart = session.lastTimestamp;
                    const nptStart = 0.0;
                    const playResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nSession: ${sessionId3}\r\nRange: npt=${nptStart.toFixed(3)}-\r\nRTP-Info: url=rtsp://127.0.0.1:554${session.path}/trackID=1;seq=${session.lastSeq};rtptime=${rtpStart}\r\n\r\n`;
                    socket.write(playResponse);

                    this.startRTPStream(session);
                    break;
                    
                case 'PAUSE':
                    const sessionIdPause = headers.Session;
                    const sessionPause = this.sessions.get(sessionIdPause);
                    if (!sessionPause) {
                        socket.write(`RTSP/1.0 454 session not found\r\nCSeq: ${cseq}\r\n\r\n`);
                        return;
                    }
                    
                    //pause the stream by stopping RTP transmission
                    if (sessionPause.state === 'playing') {
                        sessionPause.state = 'paused';
                        
                        //stop RTP and RTCP intervals
                        if (sessionPause.rtpInterval) {
                            clearInterval(sessionPause.rtpInterval);
                            sessionPause.rtpInterval = null;
                        }
                        if (sessionPause.rtcpInterval) {
                            clearInterval(sessionPause.rtcpInterval);
                            sessionPause.rtcpInterval = null;
                        }
                        
                        console.log(`Stream paused for session ${sessionIdPause}`);
                    }
                    
                    const pauseResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nSession: ${sessionIdPause}\r\n\r\n`;
                    socket.write(pauseResponse);
                    break;
                    
                case 'TEARDOWN':
                    const sessionId4 = headers.Session;
                    if (sessionId4 && this.sessions.has(sessionId4)) {
                        const sess = this.sessions.get(sessionId4);
                        if (sess.rtpInterval) {
                            clearInterval(sess.rtpInterval);
                        }
                        if (sess.rtcpInterval) {
                            clearInterval(sess.rtcpInterval);
                        }
                        this.sessions.delete(sessionId4);
                    }
                    socket.write(`RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nSession: ${sessionId4}\r\n\r\n`);
                    break;
                    
                default:
                    socket.write(`RTSP/1.0 501 not implemented\r\nCSeq: ${cseq}\r\n\r\n`);
            }
        } catch (error) {
            console.error('Error handling request:', error);
            socket.write(`RTSP/1.0 500 internal server error\r\nCSeq: 1\r\n\r\n`);
        }
    }

    startRTPStream(session) {
        const rtp = dgram.createSocket('udp4');
        const rtcp = dgram.createSocket('udp4');
        
        const ssrc = 0x12345678;
        const clockRate = 90000; //90khz for video
        const frameRate = 30; //30 fps
        const timestampIncrement = clockRate / frameRate; //3000
        const frameInterval = 1000 / frameRate; //~33.33ms between frames
        
        //load test image (img.jpg)
        let jpeg;
        try {
            const imagePath = path.join(__dirname, 'img.jpg');
            jpeg = fs.readFileSync(imagePath);
        } catch (e) {
            console.log(`Could not load the image: ${e.message}`);
            console.log('Please ensure the image is present. Exiting...');
            rtp.close();
            rtcp.close();
            return;
        }

        console.log(`Starting RTP stream to ${session.clientAddress}:${session.clientRtpPort}`);
        console.log(`RTCP stream to ${session.clientAddress}:${session.clientRtcpPort}`);
        console.log(`Frame rate: ${frameRate} fps, Frame interval: ${frameInterval.toFixed(2)}ms, Timestamp increment: ${timestampIncrement}`);

        //store sockets in session for cleanup
        session.rtpSocket = rtp;
        session.rtcpSocket = rtcp;
        
        //initialize counters using session values (lastSeq, packetsSent, octetsSent)
        let seq = session.lastSeq || 0;
        let packetsSent = session.packetsSent || 0;
        let octetsSent = session.octetsSent || 0;
        
        //track real-time starting point, preserve existing if resuming
        const streamStartTime = session.streamStartTime || Date.now();
        let rtpTimestamp = session.lastTimestamp || 0; //start from session's initialized timestamp
        
        //calculate initial ntp timestamp for rtcp sync
        const ntpStartSec = Math.floor(streamStartTime / 1000) + 2208988800; //ntp seconds since 1900
        const ntpStartFrac = Math.floor((streamStartTime % 1000) * 4294967.296); //ntp fractional seconds

        const sendFrame = () => {
            if (session.state !== 'playing') {
                if (session.rtpInterval) {
                    clearInterval(session.rtpInterval);
                }
                rtp.close();
                rtcp.close();
                return;
            }

            //calculate current time for logging
            const now = Date.now();
            const elapsedMs = now - streamStartTime;
            
            //create rtp header (12 bytes)
            const rtpHeader = Buffer.alloc(12);
            rtpHeader[0] = 0x80; //version=2, padding=0, extension=0, cc=0
            rtpHeader[1] = 0x9A; //m=1 (mark bit for jpeg), pt=26 (jpeg)
            rtpHeader.writeUInt16BE(seq & 0xFFFF, 2); //sequence number
            rtpHeader.writeUInt32BE(rtpTimestamp & 0xFFFFFFFF, 4); //timestamp
            rtpHeader.writeUInt32BE(ssrc, 8); //ssrc

            //jpeg rtp payload header (8 bytes) - minimal header
            const jpegHeader = Buffer.alloc(8);
            jpegHeader[0] = 0; //type-specific
            jpegHeader[1] = 0; //fragment offset (24-bit) - high
            jpegHeader[2] = 0; //fragment offset - middle
            jpegHeader[3] = 0; //fragment offset - low
            jpegHeader[4] = 0; //type (0 = 4:2:2)
            jpegHeader[5] = 80; //q factor
            jpegHeader[6] = 160 / 8; //width in 8-pixel blocks
            jpegHeader[7] = 160 / 8; //height in 8-pixel blocks

            //build complete rtp packet
            const rtpPacket = Buffer.concat([rtpHeader, jpegHeader, jpeg]);

            //send rtp packet
            rtp.send(rtpPacket, 0, rtpPacket.length, session.clientRtpPort, session.clientAddress || '127.0.0.1', (err) => {
                if (err) {
                    console.error('RTP send error:', err);
                } else {
                    packetsSent++;
                    octetsSent += rtpPacket.length;
                    
                    //log every second (30 frames)
                    if (seq % 30 === 0) {
                        const streamSeconds = Math.floor(elapsedMs / 1000);
                        const expectedTimestamp = streamSeconds * clockRate;
                        console.log(`Real time: ${streamSeconds}s, Frame: ${seq}, RTP timestamp: ${rtpTimestamp}, Expected: ${expectedTimestamp}`);
                    }
                }
            });

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

        //send rtcp sender reports
        const sendRTCP = () => {
            if (session.state !== 'playing') {
                return;
            }

            const now = Date.now();
            const ntpSec = Math.floor(now / 1000) + 2208988800; //ntp seconds since 1900
            const ntpFrac = Math.floor((now % 1000) * 4294967.296); //ntp fractional seconds
            
            //use the current rtp timestamp (which should match the last sent frame)
            const currentRtpTimestamp = session.lastTimestamp || 0;

            //rtcp sender report (sr)
            const rtcpSR = Buffer.alloc(28);
            
            //header
            rtcpSR[0] = 0x80; //v=2, p=0, rc=0
            rtcpSR[1] = 200; //pt=200 (sr)
            rtcpSR.writeUInt16BE(6, 2); //length = 6 (28 bytes / 4 - 1)
            rtcpSR.writeUInt32BE(ssrc, 4); //ssrc
            
            //sender info
            rtcpSR.writeUInt32BE(ntpSec, 8); //ntp timestamp (seconds)
            rtcpSR.writeUInt32BE(ntpFrac, 12); //ntp timestamp (fraction)
            rtcpSR.writeUInt32BE(currentRtpTimestamp & 0xFFFFFFFF, 16); //rtp timestamp
            rtcpSR.writeUInt32BE(session.packetsSent || 0, 20); //packet count
            rtcpSR.writeUInt32BE(session.octetsSent || 0, 24); //octet count

            rtcp.send(rtcpSR, 0, rtcpSR.length, session.clientRtcpPort, session.clientAddress || '127.0.0.1', (err) => {
                if (err) {
                    console.error('RTCP send error:', err);
                } else {
                    const elapsedMs = now - streamStartTime;
                    console.log(`RTCP SR sent - RTP timestamp: ${currentRtpTimestamp}, elapsed: ${elapsedMs}ms`);
                }
            });
        };

        //send first rtcp immediately to establish sync
        sendRTCP();
        
        //send first frame immediately
        sendFrame();
        
        //schedule frames at exact intervals (30 fps)
        session.rtpInterval = setInterval(sendFrame, frameInterval);
        
        //send rtcp every second
        session.rtcpInterval = setInterval(sendRTCP, 1000);
    }
}

const rtsp = new RTSPServer();
const server = net.createServer(socket => {
    console.log('RTSP client connected from', socket.remoteAddress);
    
    socket.on('data', async data => {
        await rtsp.handleRequest(socket, data);
    });
    
    socket.on('error', err => {
        console.error('Socket error:', err);
    });
    
    socket.on('close', () => {
        console.log('RTSP client disconnected');
        for (const [sessionId, session] of rtsp.sessions) {
            if (session.socket === socket) {
                if (session.rtpSocket) session.rtpSocket.close();
                if (session.rtcpSocket) session.rtcpSocket.close();
                if (session.rtpInterval) clearInterval(session.rtpInterval);
                if (session.rtcpInterval) clearInterval(session.rtcpInterval);
                rtsp.sessions.delete(sessionId);
            }
        }
    });
});

server.listen(554, '0.0.0.0', () => {
    console.log('RTSP server listening on rtsp://0.0.0.0:554/stream');
    console.log('Test with: rtsp://localhost:554/stream');
    console.log('Authentication required - use database users for access');
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});