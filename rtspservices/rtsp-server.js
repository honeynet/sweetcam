const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const dbConfig = require('./config/db-config.js');
const BrandDetector = require('./utils/brand-detector');
const { rtspLogger } = require('./utils/logger');

//get configuration from environment variables
const BRAND = process.env.BRAND || 'auto';
const RTSP_PORT = parseInt(process.env.RTSP_PORT) || 554;

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

const pool = mysql.createPool(poolConfig);

//test database connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Failed to connect to database:', err.message);

        rtspLogger.logRTSPError(err, 'database_connection', null, 'auto', RTSP_PORT);
    } else {

        rtspLogger.logRTSPDatabaseAuth(null, null, true, null, 'auto', RTSP_PORT);
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
        console.error('Error parsing authorization header:', error.message);
        return null;
    }
}

function authenticateUser(username, password) {
    return new Promise((resolve) => {
        const lowerUsername = username.toLowerCase();
        const query = 'SELECT name, passwordHash FROM users WHERE LOWER(name) = ?';
        
        pool.query(query, [lowerUsername], (error, results) => {
            if (error) {
                console.error('Database query error:', error.message);
        
                rtspLogger.logRTSPDatabaseAuth(null, username, false, error.message, 'auto', RTSP_PORT);
                resolve(false);
                return;
            }
            
            if (results.length === 0) {
        
                rtspLogger.logRTSPDatabaseAuth(null, username, false, 'user_not_found', 'auto', RTSP_PORT);
                resolve(false);
                return;
            }
            
            //check all password hashes for this user
            for (const user of results) {
                try {
                    const isValid = bcrypt.compareSync(password, user.passwordHash);
                    if (isValid) {
                
                        rtspLogger.logRTSPDatabaseAuth(null, username, true, null, 'auto', RTSP_PORT);
                        resolve(true);
                        return;
                    }
                } catch (bcryptError) {
                    console.error('Bcrypt comparison error:', bcryptError.message);
                    continue; //try next hash if this one fails
                }
            }
            
    
            rtspLogger.logRTSPDatabaseAuth(null, username, false, 'wrong_password', 'auto', RTSP_PORT);
            resolve(false);
        });
    });
}
class RTSPServer {
    constructor() {
        this.sessions = new Map(); 
        this.streams = new Map();
        this.sessionCounter = 0;
        this.brandDetector = new BrandDetector();
        this.forcedBrand = BRAND !== 'auto' ? BRAND : null;
        this.setupStreams();
    }

    setupStreams() {
        //stup streams for each brand
        const brands = ['hikvision', 'dahua', 'axis', 'reolink', 'mobotix', 'vstarcam'];
        
        brands.forEach(brand => {
            this.streams.set(`/${brand}`, {
                name: `${brand} Video stream`,
                rtpPort: 8002,
                rtcpPort: 8003,
                brand: brand
            });
        });
        
        //default stream
        this.streams.set('/stream', {
            name: 'Video stream',
            rtpPort: 8002,
            rtcpPort: 8003,
            brand: this.forcedBrand || 'hikvision'
        });
    }

    generateSessionId() {
        return `session_${++this.sessionCounter}`;
    }

    generateSDP(name = 'Video stream', serverAddress = '127.0.0.1', brand = 'hikvision') { 
        const brandConfig = this.brandDetector.getBrandConfig(brand);
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
        if (!transportHeader) {
            return { rtpPort: 8000, rtcpPort: 8001 };
        }
        
        const parts = transportHeader.split(';');
        const clientPorts = parts.find(p => p.includes('client_port'));
        if (clientPorts) {
            const match = clientPorts.match(/client_port=(\d+)-(\d+)/);
            if (match) {
                const rtpPort = parseInt(match[1]);
                const rtcpPort = parseInt(match[2]);
                return { rtpPort, rtcpPort };
            }
        }
        
        return { rtpPort: 8000, rtcpPort: 8001 };
    }

    async handleRequest(socket, data) {
        const dataStr = data.toString();
        const firstLine = dataStr.split('\r\n')[0];
        
        if (!dataStr.includes('RTSP/1.0') && !dataStr.includes('RTSP/1.1')) {
            return;
        }
        
        try {
            const { method, url, headers } = this.parseRTSPRequest(data);
            const cseq = headers.CSeq || headers.Cseq || '1';
            const sessionId = headers.Session;
            
            //detect brand based on connection and request
            let brand;
            if (this.forcedBrand) {
                brand = this.forcedBrand;
            } else {
                brand = this.brandDetector.detectBrand(socket, dataStr, url);
            }
            
            const brandConfig = this.brandDetector.getBrandConfig(brand);
            
            // Capture request payload for logging
            const requestPayload = {
                headers: headers,
                body: dataStr,
                transport: headers.Transport || null,
                session: sessionId
            };
            
            //log RTSP method request
            rtspLogger.logRTSPMethod(socket.remoteAddress, method, url, sessionId, brand, RTSP_PORT);
            
            //check if we have an authenticated session
            let authenticatedSession = null;
            if (sessionId && this.sessions.has(sessionId)) {
                authenticatedSession = this.sessions.get(sessionId);
            }
            
            //authentication check (only for DESCRIBE and later methods)
            if (method === 'DESCRIBE' || method === 'SETUP' || method === 'PLAY' || method === 'PAUSE' || method === 'TEARDOWN') {
                if (authenticatedSession && authenticatedSession.authenticated) {
                //using authenticated session
                } else {
                    let credentials = null;
                    
                    //first try to get credentials from authorization header
                    const authLine = dataStr.split('\r\n').find(line => line.startsWith('Authorization:'));
                    if (authLine) {
                        credentials = parseAuthorization(authLine);
                    }
                    
                    //if no athorization header, try to extract from URL
                    if (!credentials && url.includes('@')) {
                        try {
                            let urlMatch = url.match(/rtsp:\/\/([^:]+):([^@]+)@([^\/]+)(\/.*)/);
                            if (!urlMatch) {
                                urlMatch = url.match(/rtsp:\/\/([^:]+):([^@]+)@([^\/]+)/);
                            }
                            if (urlMatch) {
                                credentials = {
                                    username: urlMatch[1],
                                    password: urlMatch[2]
                                };
                            }
                        } catch (e) {
                            console.error('Error parsing URL credentials:', e.message);
                        }
                    }
                    
                    if (!credentials) {
                        const nonce = this.brandDetector.generateNonce();
                        const response = brandConfig.patterns.unauthorized(nonce);
                        
                        // Log the request/response with payloads
                        rtspLogger.logRTSPSessionWithPayload(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            401, 
                            sessionId, 
                            brand, 
                            RTSP_PORT,
                            requestPayload,
                            { status: 401, headers: response.split('\r\n'), body: response }
                        );
                        
                        socket.write(response);
                        return;
                    }

                    try {
                        const isValid = await authenticateUser(credentials.username, credentials.password);
                        if (!isValid) {
                            const nonce = this.brandDetector.generateNonce();
                            const response = brandConfig.patterns.unauthorized(nonce);
                            
                            // Log the request/response with payloads
                            rtspLogger.logRTSPSessionWithPayload(
                                socket.remoteAddress, 
                                method, 
                                url, 
                                401, 
                                sessionId, 
                                brand, 
                                RTSP_PORT,
                                requestPayload,
                                { status: 401, headers: response.split('\r\n'), body: response }
                            );
                            
                            socket.write(response);
                            return;
                        }
                        
                        //mark session as authenticated for any authenticated request
                        if (sessionId) {
                            if (this.sessions.has(sessionId)) {
                                this.sessions.get(sessionId).authenticated = true;
                                this.sessions.get(sessionId).username = credentials.username;
                            } else {
                                // Create new session if it doesn't exist
                                this.sessions.set(sessionId, {
                                    authenticated: true,
                                    username: credentials.username,
                                    socket: socket,
                                    state: 'new'
                                });
                            }
                        } else {
                            // Create new session ID if none provided
                            const newSessionId = this.generateSessionId();
                            this.sessions.set(newSessionId, {
                                authenticated: true,
                                username: credentials.username,
                                socket: socket,
                                state: 'new'
                            });
                        }
                    } catch (err) {
                        console.error('Authentication error:', err.message);
                        const errorResponse = `RTSP/1.0 500 Internal Server Error\r\nCSeq: ${cseq}\r\n\r\n`;
                        
                        // Log the request/response with payloads
                        rtspLogger.logRTSPSessionWithPayload(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            500, 
                            sessionId, 
                            brand, 
                            RTSP_PORT,
                            requestPayload,
                            { status: 500, headers: errorResponse.split('\r\n'), body: errorResponse }
                        );
                        
                        socket.write(errorResponse);
                        return;
                    }
                }
            }
            
            if (method === 'OPTIONS') {
                //send brand-specific OPTIONS response
                let response;
                if (brand === 'dahua') {
                    //dahua returns 405 Method Not Allowed for OPTIONS
                    response = brandConfig.patterns.options.pattern1;
                } else if (cseq === '42') {
                    //special case for pattern 3 (Hikvision specific)
                    response = brandConfig.patterns.options.pattern2(cseq);
                } else {
                    response = brandConfig.patterns.options.pattern1;
                }
                
                // Log the request/response with payloads
                rtspLogger.logRTSPSessionWithPayload(
                    socket.remoteAddress, 
                    method, 
                    url, 
                    200, 
                    sessionId, 
                    brand, 
                    RTSP_PORT,
                    requestPayload,
                    { status: 200, headers: response.split('\r\n'), body: response }
                );
                
                rtspLogger.logRTSPSOptions(socket.remoteAddress, headers['User-Agent'], brand, RTSP_PORT);
                rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionId, brand, RTSP_PORT);
                socket.write(response);
                return;
            }
            
            let path = this.extractPath(url);
            if (path === '/' && this.streams.size === 1) {
                const streamPath = Array.from(this.streams.keys())[0];
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
                const notFoundResponse = `RTSP/1.0 404 Not Found\r\nCSeq: ${cseq}\r\n\r\n`;
                
                // Log the request/response with payloads
                rtspLogger.logRTSPSessionWithPayload(
                    socket.remoteAddress, 
                    method, 
                    url, 
                    404, 
                    sessionId, 
                    brand, 
                    RTSP_PORT,
                    requestPayload,
                    { status: 404, headers: notFoundResponse.split('\r\n'), body: notFoundResponse }
                );
                
                socket.write(notFoundResponse);
                return;
            }

            switch (method) {
                case 'DESCRIBE':
                    if (!stream) {
                        const notFoundResponse = `RTSP/1.0 404 Not Found\r\nCSeq: ${cseq}\r\n\r\n`;
                        
                        // Log the request/response with payloads
                        rtspLogger.logRTSPSessionWithPayload(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            404, 
                            sessionId, 
                            brand, 
                            RTSP_PORT,
                            requestPayload,
                            { status: 404, headers: notFoundResponse.split('\r\n'), body: notFoundResponse }
                        );
                        
                        rtspLogger.logRTSPResponse(socket.remoteAddress, method, 404, sessionId, brand, RTSP_PORT);
                        socket.write(notFoundResponse);
                        return;
                    }
                    const serverAddress = socket.localAddress || '127.0.0.1';
                    const sdp = this.generateSDP(stream.name, serverAddress, stream.brand);
                    const baseURL = `rtsp://${serverAddress}:${RTSP_PORT}${path}/`;
                    const sdpResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nContent-Type: application/sdp\r\nContent-Base: ${baseURL}\r\nContent-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`;
                    
                    // Log the request/response with payloads
                    rtspLogger.logRTSPSessionWithPayload(
                        socket.remoteAddress, 
                        method, 
                        url, 
                        200, 
                        sessionId, 
                        brand, 
                        RTSP_PORT,
                        requestPayload,
                        { status: 200, headers: sdpResponse.split('\r\n'), body: sdpResponse }
                    );
                    
                    rtspLogger.logRTSPDescribe(socket.remoteAddress, url, headers['User-Agent'], brand, RTSP_PORT);
                    rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionId, brand, RTSP_PORT);
                    socket.write(sdpResponse);
                    break;
                    
                case 'SETUP':
                    this.sessionCounter++;
                    const sessionId2 = this.sessionCounter.toString();
                    const transport = this.parseTransport(headers.Transport || '');
                    
                    const serverRtpPort = 8002;
                    const serverRtcpPort = 8003;
                    
                    this.sessions.set(sessionId2, {
                        path: stream ? stream.name : '/stream',
                        state: 'setup',
                        rtpPort: serverRtpPort,
                        clientRtpPort: transport.rtpPort,
                        clientRtcpPort: transport.rtcpPort,
                        clientAddress: socket.remoteAddress,
                        socket: socket,
                        authenticated: true,
                        brand: stream ? stream.brand : brand
                    });

                    const setupResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nTransport: RTP/AVP;unicast;client_port=${transport.rtpPort}-${transport.rtcpPort};server_port=${serverRtpPort}-${serverRtcpPort}\r\nSession: ${sessionId2}\r\n\r\n`;
                    
                    // Log the request/response with payloads
                    rtspLogger.logRTSPSessionWithPayload(
                        socket.remoteAddress, 
                        method, 
                        url, 
                        200, 
                        sessionId2, 
                        brand, 
                        RTSP_PORT,
                        requestPayload,
                        { status: 200, headers: setupResponse.split('\r\n'), body: setupResponse, session: sessionId2 }
                    );
                    
                    rtspLogger.logRTSPStreamSetup(socket.remoteAddress, sessionId2, stream ? stream.name : '/stream', transport, brand, RTSP_PORT);
                    rtspLogger.logRTSPSession(socket.remoteAddress, sessionId2, 'created', stream ? stream.name : '/stream', brand, RTSP_PORT);
                    rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionId2, brand, RTSP_PORT);
                    socket.write(setupResponse);
                    break;
                    
                case 'PLAY':
                    const sessionId3 = headers.Session;
                    const session = this.sessions.get(sessionId3);
                    if (!session) {
                        const sessionNotFoundResponse = `RTSP/1.0 454 session not found\r\nCSeq: ${cseq}\r\n\r\n`;
                        
                        // Log the request/response with payloads
                        rtspLogger.logRTSPSessionWithPayload(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            454, 
                            sessionId3, 
                            brand, 
                            RTSP_PORT,
                            requestPayload,
                            { status: 454, headers: sessionNotFoundResponse.split('\r\n'), body: sessionNotFoundResponse }
                        );
                        
                        rtspLogger.logRTSPResponse(socket.remoteAddress, method, 454, sessionId3, brand, RTSP_PORT);
                        socket.write(sessionNotFoundResponse);
                        return;
                    }
                    
                    const isResuming = session.state === 'paused';
                    session.state = 'playing';

                    if (!isResuming) {
                        const nowMs = Date.now();
                        session.startTimeMs = nowMs;
                        session.frameNumber = 0;
                        session.lastSeq = 1;
                        session.rtpStartTimestamp = Math.floor(nowMs / 1000) % 1000000;
                        session.lastTimestamp = session.rtpStartTimestamp;
                    } else {
                        session.startTimeMs = Date.now();
                    }

                    const rtpStart = session.lastTimestamp;
                    const nptStart = 0.0;
                    const playResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nSession: ${sessionId3}\r\nRange: npt=${nptStart.toFixed(3)}-\r\nRTP-Info: url=rtsp://127.0.0.1:${RTSP_PORT}${session.path}/trackID=1;seq=${session.lastSeq};rtptime=${rtpStart}\r\n\r\n`;
                    
                    // Log the request/response with payloads
                    rtspLogger.logRTSPSessionWithPayload(
                        socket.remoteAddress, 
                        method, 
                        url, 
                        200, 
                        sessionId3, 
                        brand, 
                        RTSP_PORT,
                        requestPayload,
                        { status: 200, headers: playResponse.split('\r\n'), body: playResponse, session: sessionId3 }
                    );
                    
                    rtspLogger.logRTSPStreamPlay(socket.remoteAddress, sessionId3, session.path, brand, RTSP_PORT);
                    rtspLogger.logRTSPSession(socket.remoteAddress, sessionId3, 'playing', session.path, brand, RTSP_PORT);
                    rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionId3, brand, RTSP_PORT);
                    socket.write(playResponse);

                    this.startRTPStream(session);
                    break;
                    
                case 'PAUSE':
                    const sessionIdPause = headers.Session;
                    const sessionPause = this.sessions.get(sessionIdPause);
                    if (!sessionPause) {
                        const sessionNotFoundResponse = `RTSP/1.0 454 session not found\r\nCSeq: ${cseq}\r\n\r\n`;
                        
                        // Log the request/response with payloads
                        rtspLogger.logRTSPSessionWithPayload(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            454, 
                            sessionIdPause, 
                            brand, 
                            RTSP_PORT,
                            requestPayload,
                            { status: 454, headers: sessionNotFoundResponse.split('\r\n'), body: sessionNotFoundResponse }
                        );
                        
                        rtspLogger.logRTSPResponse(socket.remoteAddress, method, 454, sessionIdPause, brand, RTSP_PORT);
                        socket.write(sessionNotFoundResponse);
                        return;
                    }
                    
                    if (sessionPause.state === 'playing') {
                        sessionPause.state = 'paused';
                        
                        if (sessionPause.rtpInterval) {
                            clearInterval(sessionPause.rtpInterval);
                            sessionPause.rtpInterval = null;
                        }
                        if (sessionPause.rtcpInterval) {
                            clearInterval(sessionPause.rtcpInterval);
                            sessionPause.rtcpInterval = null;
                        }
                    }
                    
                    const pauseResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nSession: ${sessionIdPause}\r\n\r\n`;
                    
                    // Log the request/response with payloads
                    rtspLogger.logRTSPSessionWithPayload(
                        socket.remoteAddress, 
                        method, 
                        url, 
                        200, 
                        sessionIdPause, 
                        brand, 
                        RTSP_PORT,
                        requestPayload,
                        { status: 200, headers: pauseResponse.split('\r\n'), body: pauseResponse, session: sessionIdPause }
                    );
                    
                    rtspLogger.logRTSPStreamPause(socket.remoteAddress, sessionIdPause, sessionPause.path, brand, RTSP_PORT);
                    rtspLogger.logRTSPSession(socket.remoteAddress, sessionIdPause, 'paused', sessionPause.path, brand, RTSP_PORT);
                    rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionIdPause, brand, RTSP_PORT);
                    socket.write(pauseResponse);
                    break;
                    
                case 'TEARDOWN':
                    const sessionId4 = headers.Session;
                        const sess = this.sessions.get(sessionId4);
                    if (!sess) {
                        const sessionNotFoundResponse = `RTSP/1.0 454 session not found\r\nCSeq: ${cseq}\r\n\r\n`;
                        
                        // Log the request/response with payloads
                        rtspLogger.logRTSPSessionWithPayload(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            454, 
                            sessionId4, 
                            brand, 
                            RTSP_PORT,
                            requestPayload,
                            { status: 454, headers: sessionNotFoundResponse.split('\r\n'), body: sessionNotFoundResponse }
                        );
                        
                        rtspLogger.logRTSPResponse(socket.remoteAddress, method, 454, sessionId4, brand, RTSP_PORT);
                        socket.write(sessionNotFoundResponse);
                        return;
                    }
                    
                    if (sess.rtpInterval) {
                        clearInterval(sess.rtpInterval);
                    }
                    if (sess.rtcpInterval) {
                        clearInterval(sess.rtcpInterval);
                    }
                    
                    this.sessions.delete(sessionId4);
                    
                    const teardownResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nSession: ${sessionId4}\r\n\r\n`;
                    
                    // Log the request/response with payloads
                    rtspLogger.logRTSPSessionWithPayload(
                        socket.remoteAddress, 
                        method, 
                        url, 
                        200, 
                        sessionId4, 
                        brand, 
                        RTSP_PORT,
                        requestPayload,
                        { status: 200, headers: teardownResponse.split('\r\n'), body: teardownResponse, session: sessionId4 }
                    );
                    
                    rtspLogger.logRTSPStreamTeardown(socket.remoteAddress, sessionId4, sess.path, brand, RTSP_PORT);
                        rtspLogger.logRTSPSession(socket.remoteAddress, sessionId4, 'destroyed', sess.path, brand, RTSP_PORT);
                    rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionId4, brand, RTSP_PORT);
                    socket.write(teardownResponse);
                    break;
                    
                default:
                    socket.write(`RTSP/1.0 501 not implemented\r\nCSeq: ${cseq}\r\n\r\n`);
            }
        } catch (error) {
            console.error('Error handling request:', error.message);
            socket.write(`RTSP/1.0 500 internal server error\r\nCSeq: 1\r\n\r\n`);
        }
    }

    createFallbackFrame() {
        // Create a simple 160x120 colored JPEG frame as fallback
        // This is a minimal JPEG header + a simple colored frame
        const width = 160;
        const height = 120;
        
        // Create a simple colored frame (blue background with white text)
        const frameData = Buffer.alloc(width * height * 3);
        let offset = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Create a simple pattern
                if (y < height / 2) {
                    // Top half: blue
                    frameData[offset++] = 0;     // R
                    frameData[offset++] = 0;     // G
                    frameData[offset++] = 255;   // B
                } else {
                    // Bottom half: darker blue
                    frameData[offset++] = 0;     // R
                    frameData[offset++] = 0;     // G
                    frameData[offset++] = 128;   // B
                }
            }
        }
        
        // For now, return a minimal valid JPEG structure
        // In a real implementation, you'd want to properly encode this as JPEG
        // For simplicity, we'll create a basic structure that can be processed
        const jpegHeader = Buffer.from([
            0xFF, 0xD8, // SOI marker
            0xFF, 0xE0, // APP0 marker
            0x00, 0x10, // Length
            0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
            0x01, 0x01, // Version 1.1
            0x00, // Units: none
            0x00, 0x01, // Density: 1x1
            0x00, 0x01, // Density: 1x1
            0x00, 0x00  // No thumbnail
        ]);
        
        // Create a simple frame marker
        const frameMarker = Buffer.from([
            0xFF, 0xC0, // SOF0 marker
            0x00, 0x11, // Length
            0x08, // Precision
            0x00, 0x78, // Height (120)
            0x00, 0xA0, // Width (160)
            0x03, // Components
            0x01, 0x11, 0x00, // Y component
            0x02, 0x11, 0x01, // Cb component
            0x03, 0x11, 0x01  // Cr component
        ]);
        
        // Create a simple scan marker
        const scanMarker = Buffer.from([
            0xFF, 0xDA, // SOS marker
            0x00, 0x0C, // Length
            0x03, // Components
            0x01, 0x00, // Y component
            0x02, 0x11, // Cb component
            0x03, 0x11, // Cr component
            0x00, 0x3F, // Ss
            0x00  // Se
        ]);
        
        // Create EOI marker
        const eoiMarker = Buffer.from([0xFF, 0xD9]);
        
        // Combine all parts
        return Buffer.concat([jpegHeader, frameMarker, scanMarker, frameData, eoiMarker]);
    }

    startRTPStream(session) {
        const rtp = dgram.createSocket('udp4');
        const rtcp = dgram.createSocket('udp4');
        
        const ssrc = 0x12345678;
        const clockRate = 90000;
        const frameRate = 30;
        const timestampIncrement = clockRate / frameRate;
        const frameInterval = 1000 / frameRate;
        
        let jpeg;
        try {
            // Try to load the default image
            const imagePath = path.join(__dirname, 'img.jpg');
            jpeg = fs.readFileSync(imagePath);
        } catch (e) {
            console.error(`Could not load the default image: ${e.message}`);
            
            // Try alternative image files
            const alternativeImages = ['img.png', 'test.jpg', 'mini.jpg'];
            let imageFound = false;
            
            for (const altImage of alternativeImages) {
                try {
                    const altImagePath = path.join(__dirname, altImage);
                    jpeg = fs.readFileSync(altImagePath);
                    console.log(`Using alternative image: ${altImage}`);
                    imageFound = true;
                    break;
                } catch (altError) {
                    // Continue trying other alternatives
                    continue;
                }
            }
            
            // If no images found, create a simple colored frame as fallback
            if (!imageFound) {
                console.log('No image files found, creating fallback frame');
                jpeg = this.createFallbackFrame();
            }
        }


        session.rtpSocket = rtp;
        session.rtcpSocket = rtcp;
        
        let seq = session.lastSeq || 0;
        let packetsSent = session.packetsSent || 0;
        let octetsSent = session.octetsSent || 0;
        
        const streamStartTime = session.streamStartTime || Date.now();
        let rtpTimestamp = session.lastTimestamp || 0;
        
        const ntpStartSec = Math.floor(streamStartTime / 1000) + 2208988800;
        const ntpStartFrac = Math.floor((streamStartTime % 1000) * 4294967.296);

        const sendFrame = () => {
            if (session.state !== 'playing') {
                if (session.rtpInterval) {
                    clearInterval(session.rtpInterval);
                }
                rtp.close();
                rtcp.close();
                return;
            }

            const now = Date.now();
            const elapsedMs = now - streamStartTime;
            
            // Fragment large images into smaller RTP packets
            const maxPacketSize = 1400; // Safe UDP packet size
            const jpegHeaderSize = 8;
            const rtpHeaderSize = 12;
            const maxPayloadSize = maxPacketSize - rtpHeaderSize - jpegHeaderSize;
            
            // Calculate how many fragments we need
            const totalFragments = Math.ceil(jpeg.length / maxPayloadSize);
            
            for (let fragmentIndex = 0; fragmentIndex < totalFragments; fragmentIndex++) {
                const start = fragmentIndex * maxPayloadSize;
                const end = Math.min(start + maxPayloadSize, jpeg.length);
                const fragmentData = jpeg.slice(start, end);
                
                const rtpHeader = Buffer.alloc(12);
                rtpHeader[0] = 0x80;
                rtpHeader[1] = 0x9A;
                
                // Set fragmentation flags
                if (fragmentIndex === 0) {
                    rtpHeader[1] |= 0x80; // Set start bit
                }
                if (fragmentIndex === totalFragments - 1) {
                    rtpHeader[1] |= 0x40; // Set end bit
                }
                
                rtpHeader.writeUInt16BE(seq & 0xFFFF, 2);
                rtpHeader.writeUInt32BE(rtpTimestamp & 0xFFFFFFFF, 4);
                rtpHeader.writeUInt32BE(ssrc, 8);

                const jpegHeader = Buffer.alloc(8);
                jpegHeader[0] = 0;
                jpegHeader[1] = 0;
                jpegHeader[2] = 0;
                jpegHeader[3] = 0;
                jpegHeader[4] = 0;
                jpegHeader[5] = 80;
                jpegHeader[6] = 160 / 8;
                jpegHeader[7] = 160 / 8;

                const rtpPacket = Buffer.concat([rtpHeader, jpegHeader, fragmentData]);

                rtp.send(rtpPacket, 0, rtpPacket.length, session.clientRtpPort, session.clientAddress || '127.0.0.1', (err) => {
                    if (err) {
                        console.error('RTP send error:', err.message);
                    } else {
                        packetsSent++;
                        octetsSent += rtpPacket.length;
                    }
                });
                
                seq++;
            }

            session.frameNumber = seq;
            session.lastSeq = seq;
            session.lastTimestamp = rtpTimestamp;
            session.packetsSent = packetsSent;
            session.lastOctetsSent = octetsSent;
            session.streamStartTime = streamStartTime;
            
            rtpTimestamp += timestampIncrement;
        };

        const sendRTCP = () => {
            if (session.state !== 'playing') {
                return;
            }

            const now = Date.now();
            const ntpSec = Math.floor(now / 1000) + 2208988800;
            const ntpFrac = Math.floor((now % 1000) * 4294967.296);
            
            const currentRtpTimestamp = session.lastTimestamp || 0;

            const rtcpSR = Buffer.alloc(28);
            
            rtcpSR[0] = 0x80;
            rtcpSR[1] = 200;
            rtcpSR.writeUInt16BE(6, 2);
            rtcpSR.writeUInt32BE(ssrc, 4);
            
            rtcpSR.writeUInt32BE(ntpSec, 8);
            rtcpSR.writeUInt32BE(ntpFrac, 12);
            rtcpSR.writeUInt32BE(currentRtpTimestamp & 0xFFFFFFFF, 16);
            rtcpSR.writeUInt32BE(session.packetsSent || 0, 20);
            rtcpSR.writeUInt32BE(session.octetsSent || 0, 24);

            rtcp.send(rtcpSR, 0, rtcpSR.length, session.clientRtcpPort, session.clientAddress || '127.0.0.1', (err) => {
                if (err) {
                    console.error('RTCP send error:', err.message);
                }
            });
        };

        sendRTCP();
        sendFrame();
        
        session.rtpInterval = setInterval(sendFrame, frameInterval);
        session.rtcpInterval = setInterval(sendRTCP, 1000);
    }
}

// Export the RTSPServer class for testing
module.exports = { RTSPServer };

const rtsp = new RTSPServer();
const server = net.createServer(socket => {
    
    socket.on('data', async data => {
        await rtsp.handleRequest(socket, data);
    });
    
    socket.on('error', err => {
        console.error('Socket error:', err.message);
    });
    
    socket.on('close', () => {
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

server.listen(RTSP_PORT, '0.0.0.0', () => {
    
    rtspLogger.logRTSPServiceEvent('started', `RTSP server started on port ${RTSP_PORT}`, 'auto', RTSP_PORT);
});

process.on('SIGINT', () => {
    
    rtspLogger.logRTSPServiceEvent('stopping', 'RTSP server shutting down', 'auto', RTSP_PORT);
    server.close(() => {
        rtspLogger.logRTSPServiceEvent('stopped', 'RTSP server stopped', 'auto', RTSP_PORT);
        process.exit(0);
    });
});