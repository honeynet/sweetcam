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
const REQUIRE_RTSP_AUTH = process.env.REQUIRE_RTSP_AUTH !== 'false';

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
                // Database authentication logging is now handled by the calling function
                resolve(false);
                return;
            }
            
            if (results.length === 0) {
                // Database authentication logging is now handled by the calling function
                resolve(false);
                return;
            }
            
            //check all password hashes for this user
            for (const user of results) {
                try {
                    const isValid = bcrypt.compareSync(password, user.passwordHash);
                    if (isValid) {
                        // Database authentication logging is now handled by the calling function
                        resolve(true);
                        return;
                    }
                } catch (bcryptError) {
                    console.error('Bcrypt comparison error:', bcryptError.message);
                    continue; //try next hash if this one fails
                }
            }
            
            // Database authentication logging is now handled by the calling function
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
            return {
                protocol: 'udp',
                rtpPort: 8000,
                rtcpPort: 8001,
                rtpChannel: 0,
                rtcpChannel: 1
            };
        }

        const isTcp = transportHeader.toUpperCase().includes('RTP/AVP/TCP');
        const interleavedMatch = transportHeader.match(/interleaved=(\d+)-(\d+)/i);

        if (isTcp) {
            return {
                protocol: 'tcp',
                rtpPort: null,
                rtcpPort: null,
                rtpChannel: interleavedMatch ? parseInt(interleavedMatch[1], 10) : 0,
                rtcpChannel: interleavedMatch ? parseInt(interleavedMatch[2], 10) : 1
            };
        }

        const clientPorts = transportHeader.split(';').find(p => p.includes('client_port'));
        if (clientPorts) {
            const match = clientPorts.match(/client_port=(\d+)-(\d+)/);
            if (match) {
                return {
                    protocol: 'udp',
                    rtpPort: parseInt(match[1], 10),
                    rtcpPort: parseInt(match[2], 10),
                    rtpChannel: 0,
                    rtcpChannel: 1
                };
            }
        }

        return {
            protocol: 'udp',
            rtpPort: 8000,
            rtcpPort: 8001,
            rtpChannel: 0,
            rtcpChannel: 1
        };
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
            
            //log RTSP method request (only if not already logged during authentication)
            if (!(method === 'DESCRIBE' || method === 'SETUP' || method === 'PLAY' || method === 'PAUSE' || method === 'TEARDOWN')) {
                rtspLogger.logRTSPMethod(socket.remoteAddress, method, url, sessionId, brand, RTSP_PORT, this.getUsernameFromSession(sessionId), this.getPasswordFromSession(sessionId));
            }
            
            //check if we have an authenticated session
            let authenticatedSession = null;
            if (sessionId && this.sessions.has(sessionId)) {
                authenticatedSession = this.sessions.get(sessionId);
            }
            
            //authentication check (only for DESCRIBE and later methods)
            if ( REQUIRE_RTSP_AUTH && (method === 'DESCRIBE' || method === 'SETUP' || method === 'PLAY' || method === 'PAUSE' || method === 'TEARDOWN')) {
                if (authenticatedSession && authenticatedSession.authenticated) {
                    //using authenticated session - no need to re-authenticate
                    console.log('Using existing authenticated session for:', sessionId);
                } else {
                    let credentials = null;
                    let isNewAuthentication = true;
                    
                    //first try to get credentials from authorization header
                    const authLine = dataStr.split('\r\n').find(line => /^Authorization:/i.test(line));
                    if (authLine) {
                        credentials = parseAuthorization(authLine);
                    }
                    
                    //if no authorization header, try to extract from URL
                    if (!credentials && url.includes('@')) {
                        try {
                            // Handle various RTSP URL formats:
                            // rtsp://user:pass@host:port/path
                            // rtsp://user:pass@host/path
                            // rtsp://user:pass@host
                            let urlMatch = url.match(/rtsp:\/\/([^:]+):([^@]+)@([^\/]+)(?::\d+)?(?:\/.*)?/);
                            if (urlMatch) {
                                credentials = {
                                    username: urlMatch[1],
                                    password: urlMatch[2]
                                };
                                console.log('Extracted credentials from URL:', credentials.username, credentials.password);
                            }
                        } catch (e) {
                            console.error('Error parsing URL credentials:', e.message);
                        }
                    }
                    
                    if (!credentials) {
                        const response = brandConfig.patterns.unauthorized(cseq);
                        
                        // Log unauthorized request (no credentials provided)
                        rtspLogger.logRTSPMethod(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            sessionId, 
                            brand, 
                            RTSP_PORT
                        );
                        
                        socket.write(response);
                        return;
                    }

                    try {
                        const isValid = await authenticateUser(credentials.username, credentials.password);
                        if (!isValid) {
                            const response = brandConfig.patterns.unauthorized(cseq);
                            
                            // Log combined authentication failure
                            rtspLogger.logRTSPCombinedAuth(
                                socket.remoteAddress, 
                                method, 
                                url, 
                                401, 
                                sessionId, 
                                brand, 
                                RTSP_PORT,
                                credentials.username,
                                credentials.password,
                                false,
                                'invalid_credentials'
                            );
                            
                            socket.write(response);
                            return;
                        }
                        
                        //mark session as authenticated for any authenticated request
                        if (sessionId) {
                            if (this.sessions.has(sessionId)) {
                                this.sessions.get(sessionId).authenticated = true;
                                this.sessions.get(sessionId).username = credentials.username;
                                this.sessions.get(sessionId).password = credentials.password;
                                this.sessions.get(sessionId).credentialsLogged = true;
                            } else {
                                // Create new session if it doesn't exist
                                this.sessions.set(sessionId, {
                                    authenticated: true,
                                    username: credentials.username,
                                    password: credentials.password,
                                    credentialsLogged: true,
                                    socket: socket,
                                    state: 'new'
                                });
                            }
                        } else {
                            const newSessionId = this.generateSessionId();
                            this.sessions.set(newSessionId, {
                                authenticated: true,
                                username: credentials.username,
                                password: credentials.password,
                                credentialsLogged: true,
                                socket: socket,
                                state: 'new'
                            });
                        }
                        
                        if (isNewAuthentication) {
                            console.log('Authentication successful for user:', credentials.username);
                            //log combined authentication event with full credentials
                            rtspLogger.logRTSPCombinedAuth(
                                socket.remoteAddress, 
                                'AUTH', 
                                url, 
                                200, 
                                sessionId, 
                                brand, 
                                RTSP_PORT,
                                credentials.username,
                                credentials.password,
                                true
                            );
                        }
                    } catch (err) {
                        console.error('Authentication error:', err.message);
                        const errorResponse = `RTSP/1.0 500 Internal Server Error\r\nCSeq: ${cseq}\r\n\r\n`;
                        
                        //log combined authentication error
                        if (credentials) {
                            rtspLogger.logRTSPCombinedAuth(
                                socket.remoteAddress, 
                                method, 
                                url, 
                                500, 
                                sessionId, 
                                brand, 
                                RTSP_PORT,
                                credentials.username,
                                credentials.password,
                                false,
                                err.message
                            );
                        }
                        
                        socket.write(errorResponse);
                        return;
                    }
                }
            }
            
            if (method === 'OPTIONS') {
                //send brand-specific OPTIONS response
                const response =
                    `RTSP/1.0 200 OK\r\n` +
                    `CSeq: ${cseq}\r\n` +
                    `Public: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n` +
                    `\r\n`;
                
                // let response;
                // if (brand === 'dahua') {
                //     response = brandConfig.patterns.options.pattern1;
                // } else if (cseq === '42') {
                //     response = brandConfig.patterns.options.pattern2(cseq);
                // } else {
                //     response = brandConfig.patterns.options.pattern1;
                // }
                
                //log the request/response with payloads (without duplicating credentials)
                const session = this.sessions.get(sessionId);
                const shouldLogCredentials = session && !session.credentialsLogged;
                
                rtspLogger.logRTSPSessionWithPayload(
                    socket.remoteAddress, 
                    method, 
                    url, 
                    200, 
                    sessionId, 
                    brand, 
                    RTSP_PORT,
                    requestPayload,
                    { status: 200, headers: response.split('\r\n'), body: response },
                    shouldLogCredentials ? this.getUsernameFromSession(sessionId) : null,
                    shouldLogCredentials ? this.getPasswordFromSession(sessionId) : null
                );
                
                rtspLogger.logRTSPSOptions(socket.remoteAddress, headers['User-Agent'], brand, RTSP_PORT);
                //log response with credentials if they haven't been logged yet
                rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionId, brand, RTSP_PORT, 
                    this.shouldLogCredentials(sessionId) ? this.getUsernameFromSession(sessionId) : null, 
                    this.shouldLogCredentials(sessionId) ? this.getPasswordFromSession(sessionId) : null);
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
                
                //log the request/response with payloads (without duplicating credentials)
                rtspLogger.logRTSPSessionWithPayload(
                    socket.remoteAddress, 
                    method, 
                    url, 
                    404, 
                    sessionId, 
                    brand, 
                    RTSP_PORT,
                    requestPayload,
                    { status: 404, headers: notFoundResponse.split('\r\n'), body: notFoundResponse },
                    this.shouldLogCredentials(sessionId) ? this.getUsernameFromSession(sessionId) : null,
                    this.shouldLogCredentials(sessionId) ? this.getPasswordFromSession(sessionId) : null
                );
                
                socket.write(notFoundResponse);
                return;
            }

            switch (method) {
                case 'DESCRIBE':
                    if (!stream) {
                        const notFoundResponse = `RTSP/1.0 404 Not Found\r\nCSeq: ${cseq}\r\n\r\n`;
                        
                        //log the request/response with payloads (without duplicating credentials)
                        rtspLogger.logRTSPSessionWithPayload(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            404, 
                            sessionId, 
                            brand, 
                            RTSP_PORT,
                            requestPayload,
                            { status: 404, headers: notFoundResponse.split('\r\n'), body: notFoundResponse },
                            this.shouldLogCredentials(sessionId) ? this.getUsernameFromSession(sessionId) : null,
                            this.shouldLogCredentials(sessionId) ? this.getPasswordFromSession(sessionId) : null
                        );
                        
                        //log response with credentials if they haven't been logged yet
                        rtspLogger.logRTSPResponse(socket.remoteAddress, method, 404, sessionId, brand, RTSP_PORT, 
                            this.shouldLogCredentials(sessionId) ? this.getUsernameFromSession(sessionId) : null, 
                            this.shouldLogCredentials(sessionId) ? this.getPasswordFromSession(sessionId) : null);
                        socket.write(notFoundResponse);
                        return;
                    }
                    const serverAddress = socket.localAddress || '127.0.0.1';
                    const sdp = this.generateSDP(stream.name, serverAddress, stream.brand);
                    const baseURL = `rtsp://${serverAddress}:${RTSP_PORT}${path}/`;
                    const sdpResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nContent-Type: application/sdp\r\nContent-Base: ${baseURL}\r\nContent-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`;
                    
                    rtspLogger.logRTSPSessionWithPayload(
                        socket.remoteAddress, 
                        method, 
                        url, 
                        200, 
                        sessionId, 
                        brand, 
                        RTSP_PORT,
                        requestPayload,
                        { status: 200, headers: sdpResponse.split('\r\n'), body: sdpResponse },
                        this.shouldLogCredentials(sessionId) ? this.getUsernameFromSession(sessionId) : null,
                        this.shouldLogCredentials(sessionId) ? this.getPasswordFromSession(sessionId) : null
                    );
                    
                    rtspLogger.logRTSPDescribe(socket.remoteAddress, url, headers['User-Agent'], brand, RTSP_PORT);
                    rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionId, brand, RTSP_PORT, 
                        this.shouldLogCredentials(sessionId) ? this.getUsernameFromSession(sessionId) : null, 
                        this.shouldLogCredentials(sessionId) ? this.getPasswordFromSession(sessionId) : null);
                    socket.write(sdpResponse);
                    break;
                    
                case 'SETUP':
                    this.sessionCounter++;
                    const sessionId2 = this.sessionCounter.toString();
                    const transport = this.parseTransport(headers.Transport || '');
                    
                    const serverRtpPort = 8002;
                    const serverRtcpPort = 8003;
                    
                    let username = null;
                    let password = null;
                    if (sessionId && this.sessions.has(sessionId)) {
                        username = this.sessions.get(sessionId).username;
                        password = this.sessions.get(sessionId).password;
                    }
                    
                    this.sessions.set(sessionId2, {
                        path: stream ? stream.name : '/stream',
                        state: 'setup',
                        rtpPort: serverRtpPort,
                        clientRtpPort: transport.rtpPort,
                        clientRtcpPort: transport.rtcpPort,
                        transportProtocol: transport.protocol,
                        rtpChannel: transport.rtpChannel,
                        rtcpChannel: transport.rtcpChannel,
                        clientAddress: socket.remoteAddress,
                        socket: socket,
                        authenticated: true,
                        username: username,
                        password: password,
                        credentialsLogged: true,
                        brand: stream ? stream.brand : brand
                    });

                    const responseTransport = transport.protocol === 'tcp'
                        ? `RTP/AVP/TCP;unicast;interleaved=${transport.rtpChannel}-${transport.rtcpChannel}`
                        : `RTP/AVP;unicast;client_port=${transport.rtpPort}-${transport.rtcpPort};server_port=${serverRtpPort}-${serverRtcpPort}`;

                    const setupResponse = `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nTransport: ${responseTransport}\r\nSession: ${sessionId2}\r\n\r\n`;

                    rtspLogger.logRTSPSessionWithPayload(
                        socket.remoteAddress, 
                        method, 
                        url, 
                        200, 
                        sessionId2, 
                        brand, 
                        RTSP_PORT,
                        requestPayload,
                        { status: 200, headers: setupResponse.split('\r\n'), body: setupResponse, session: sessionId2 },
                        username,
                        password
                    );
                    
                    rtspLogger.logRTSPStreamSetup(socket.remoteAddress, sessionId2, stream ? stream.name : '/stream', transport, brand, RTSP_PORT, username, password);
                    rtspLogger.logRTSPSession(socket.remoteAddress, sessionId2, 'created', stream ? stream.name : '/stream', brand, RTSP_PORT, username, password);
                    rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionId2, brand, RTSP_PORT, username, password);
                    socket.write(setupResponse);
                    break;
                    
                case 'PLAY':
                    const sessionId3 = headers.Session;
                    const session = this.sessions.get(sessionId3);
                    if (!session) {
                        const sessionNotFoundResponse = `RTSP/1.0 454 session not found\r\nCSeq: ${cseq}\r\n\r\n`;
                        
                        const session = this.sessions.get(sessionId3);
                        const shouldLogCredentials = session && !session.credentialsLogged;
                        
                        rtspLogger.logRTSPSessionWithPayload(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            454, 
                            sessionId3, 
                            brand, 
                            RTSP_PORT,
                            requestPayload,
                            { status: 454, headers: sessionNotFoundResponse.split('\r\n'), body: sessionNotFoundResponse },
                            shouldLogCredentials ? this.getUsernameFromSession(sessionId3) : null,
                            shouldLogCredentials ? this.getPasswordFromSession(sessionId3) : null
                        );
                        
                        rtspLogger.logRTSPResponse(socket.remoteAddress, method, 454, sessionId3, brand, RTSP_PORT, 
                            this.shouldLogCredentials(sessionId3) ? this.getUsernameFromSession(sessionId3) : null, 
                            this.shouldLogCredentials(sessionId3) ? this.getPasswordFromSession(sessionId3) : null);
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
                    
                    rtspLogger.logRTSPSessionWithPayload(
                        socket.remoteAddress, 
                        method, 
                        url, 
                        200, 
                        sessionId3, 
                        brand, 
                        RTSP_PORT,
                        requestPayload,
                        { status: 200, headers: playResponse.split('\r\n'), body: playResponse, session: sessionId3 },
                        this.shouldLogCredentials(sessionId3) ? this.getUsernameFromSession(sessionId3) : null,
                        this.shouldLogCredentials(sessionId3) ? this.getPasswordFromSession(sessionId3) : null
                    );
                    
                      rtspLogger.logRTSPStreamPlay(socket.remoteAddress, sessionId3, session.path, brand, RTSP_PORT, 
                          this.shouldLogCredentials(sessionId3) ? this.getUsernameFromSession(sessionId3) : null, 
                          this.shouldLogCredentials(sessionId3) ? this.getPasswordFromSession(sessionId3) : null);
                      rtspLogger.logRTSPSession(socket.remoteAddress, sessionId3, 'playing', session.path, brand, RTSP_PORT, 
                          this.shouldLogCredentials(sessionId3) ? this.getUsernameFromSession(sessionId3) : null, 
                          this.shouldLogCredentials(sessionId3) ? this.getPasswordFromSession(sessionId3) : null);
                    rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionId3, brand, RTSP_PORT, 
                        this.shouldLogCredentials(sessionId3) ? this.getUsernameFromSession(sessionId3) : null, 
                        this.shouldLogCredentials(sessionId3) ? this.getPasswordFromSession(sessionId3) : null);
                    socket.write(playResponse);

                    this.startRTPStream(session);
                    break;
                    
                case 'PAUSE':
                    const sessionIdPause = headers.Session;
                    const sessionPause = this.sessions.get(sessionIdPause);
                    if (!sessionPause) {
                        const sessionNotFoundResponse = `RTSP/1.0 454 session not found\r\nCSeq: ${cseq}\r\n\r\n`;
                        
                        rtspLogger.logRTSPSessionWithPayload(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            200, 
                            sessionIdPause, 
                            brand, 
                            RTSP_PORT,
                            requestPayload,
                            { status: 454, headers: sessionNotFoundResponse.split('\r\n'), body: sessionNotFoundResponse },
                            this.shouldLogCredentials(sessionIdPause) ? this.getUsernameFromSession(sessionIdPause) : null,
                            this.shouldLogCredentials(sessionIdPause) ? this.getPasswordFromSession(sessionIdPause) : null
                        );
                        
                        rtspLogger.logRTSPResponse(socket.remoteAddress, method, 454, sessionIdPause, brand, RTSP_PORT, 
                            this.shouldLogCredentials(sessionIdPause) ? this.getUsernameFromSession(sessionIdPause) : null, 
                            this.shouldLogCredentials(sessionIdPause) ? this.getPasswordFromSession(sessionIdPause) : null);
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
                    
                    rtspLogger.logRTSPSessionWithPayload(
                        socket.remoteAddress, 
                        method, 
                        url, 
                        200, 
                        sessionIdPause, 
                        brand, 
                        RTSP_PORT,
                        requestPayload,
                        { status: 200, headers: pauseResponse.split('\r\n'), body: pauseResponse, session: sessionIdPause },
                        this.shouldLogCredentials(sessionIdPause) ? this.getUsernameFromSession(sessionIdPause) : null,
                        this.shouldLogCredentials(sessionIdPause) ? this.getPasswordFromSession(sessionIdPause) : null
                    );
                    
                        //log stream with credentials if they haven't been logged yet
                      rtspLogger.logRTSPStreamPause(socket.remoteAddress, sessionIdPause, sessionPause.path, brand, RTSP_PORT, 
                          this.shouldLogCredentials(sessionIdPause) ? this.getUsernameFromSession(sessionIdPause) : null, 
                          this.shouldLogCredentials(sessionIdPause) ? this.getPasswordFromSession(sessionIdPause) : null);
                      const sessionObj = this.sessions.get(sessionIdPause);
                      const shouldLogCredentials = sessionObj && !sessionObj.credentialsLogged;
                      rtspLogger.logRTSPSession(socket.remoteAddress, sessionIdPause, 'paused', sessionPause.path, brand, RTSP_PORT, 
                          shouldLogCredentials ? this.getUsernameFromSession(sessionIdPause) : null, 
                          shouldLogCredentials ? this.getPasswordFromSession(sessionIdPause) : null);
                    rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionIdPause, brand, RTSP_PORT, 
                        this.shouldLogCredentials(sessionIdPause) ? this.getUsernameFromSession(sessionIdPause) : null, 
                        this.shouldLogCredentials(sessionIdPause) ? this.getPasswordFromSession(sessionIdPause) : null);
                    socket.write(pauseResponse);
                    break;
                    
                case 'TEARDOWN':
                    const sessionId4 = headers.Session;
                        const sess = this.sessions.get(sessionId4);
                    if (!sess) {
                        const sessionNotFoundResponse = `RTSP/1.0 454 session not found\r\nCSeq: ${cseq}\r\n\r\n`;
                        
                        rtspLogger.logRTSPSessionWithPayload(
                            socket.remoteAddress, 
                            method, 
                            url, 
                            454, 
                            sessionId4, 
                            brand, 
                            RTSP_PORT,
                            requestPayload,
                            { status: 454, headers: sessionNotFoundResponse.split('\r\n'), body: sessionNotFoundResponse },
                            this.shouldLogCredentials(sessionId4) ? this.getUsernameFromSession(sessionId4) : null,
                            this.shouldLogCredentials(sessionId4) ? this.getPasswordFromSession(sessionId4) : null
                        );
                        
                        rtspLogger.logRTSPResponse(socket.remoteAddress, method, 454, sessionId4, brand, RTSP_PORT, 
                            this.shouldLogCredentials(sessionId4) ? this.getUsernameFromSession(sessionId4) : null, 
                            this.shouldLogCredentials(sessionId4) ? this.getPasswordFromSession(sessionId4) : null);
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
                    
                    rtspLogger.logRTSPSessionWithPayload(
                        socket.remoteAddress, 
                        method, 
                        url, 
                        200, 
                        sessionId4, 
                        brand, 
                        RTSP_PORT,
                        requestPayload,
                        { status: 200, headers: teardownResponse.split('\r\n'), body: teardownResponse, session: sessionId4 },
                        this.shouldLogCredentials(sessionId4) ? this.getUsernameFromSession(sessionId4) : null,
                        this.shouldLogCredentials(sessionId4) ? this.getPasswordFromSession(sessionId4) : null
                    );
                    
                    rtspLogger.logRTSPStreamTeardown(socket.remoteAddress, sessionId4, sess.path, brand, RTSP_PORT, 
                        this.shouldLogCredentials(sessionId4) ? this.getUsernameFromSession(sessionId4) : null, 
                        this.shouldLogCredentials(sessionId4) ? this.getPasswordFromSession(sessionId4) : null);
                    
                    rtspLogger.logRTSPSession(socket.remoteAddress, sessionId4, 'destroyed', sess.path, brand, RTSP_PORT, 
                        this.shouldLogCredentials(sessionId4) ? this.getUsernameFromSession(sessionId4) : null, 
                        this.shouldLogCredentials(sessionId4) ? this.getPasswordFromSession(sessionId4) : null);
                    
                    rtspLogger.logRTSPResponse(socket.remoteAddress, method, 200, sessionId4, brand, RTSP_PORT, 
                        this.shouldLogCredentials(sessionId4) ? this.getUsernameFromSession(sessionId4) : null, 
                        this.shouldLogCredentials(sessionId4) ? this.getPasswordFromSession(sessionId4) : null);
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
        //create a simple 160x120 colored JPEG frame as fallback
        //this is a minimal JPEG header + a simple colored frame
        const width = 160;
        const height = 120;
        
        const frameData = Buffer.alloc(width * height * 3);
        let offset = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                //create a simple pattern
                if (y < height / 2) {
                    //top half: blue
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
        
        
        const eoiMarker = Buffer.from([0xFF, 0xD9]);
        
        return Buffer.concat([jpegHeader, frameMarker, scanMarker, frameData, eoiMarker]);
    }

    writeInterleaved(socket, channel, packet) {
        const header = Buffer.alloc(4);
        header[0] = 0x24;
        header[1] = channel;
        header.writeUInt16BE(packet.length, 2);
        socket.write(Buffer.concat([header, packet]));
    }

    loadVideoFrames() {
        const framesDir = process.env.RTSP_FRAME_DIR || path.join(__dirname, 'media', 'frames');
        try {
            const frameFiles = fs.readdirSync(framesDir)
                .filter(file => /\.(jpe?g)$/i.test(file))
                .sort()
                .map(file => fs.readFileSync(path.join(framesDir, file)));

            if (frameFiles.length > 0) {
                console.log(`Loaded ${frameFiles.length} RTSP video frames from ${framesDir}`);
                return frameFiles;
            }
        } catch (error) {
            console.error(`Could not load RTSP video frames: ${error.message}`);
        }

        return null;
    }

    startRTPStream(session) {
        const useTcp = session.transportProtocol === 'tcp';
        const rtp = useTcp ? null : dgram.createSocket('udp4');
        const rtcp = useTcp ? null : dgram.createSocket('udp4');

        if (!useTcp) {
            rtp.bind(session.rtpPort);
            rtcp.bind(session.rtcpPort);
        }
        
        const ssrc = 0x12345678;
        const clockRate = 90000;
        const frameRate = parseInt(process.env.RTSP_FRAME_RATE, 10) || 15;
        const frameWidth = parseInt(process.env.RTSP_FRAME_WIDTH, 10) || 640;
        const frameHeight = parseInt(process.env.RTSP_FRAME_HEIGHT, 10) || 272;
        const timestampIncrement = clockRate / frameRate;
        const frameInterval = 1000 / frameRate;
        
        let frames = this.loadVideoFrames();
        if (!frames) {
            let jpeg;
            try {
                const imagePath = path.join(__dirname, 'img.jpg');
                jpeg = fs.readFileSync(imagePath);
            } catch (e) {
                console.error(`Could not load the default image: ${e.message}`);
            
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
                        continue;
                    }
                }
            
                if (!imageFound) {
                    console.log('No image files found, creating fallback frame');
                    jpeg = this.createFallbackFrame();
                }
            }
            frames = [jpeg];
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
                if (rtp) rtp.close();
                if (rtcp) rtcp.close();
                return;
            }

            const now = Date.now();
            const elapsedMs = now - streamStartTime;
            const frameIndex = session.videoFrameIndex || 0;
            const jpeg = frames[frameIndex];
            session.videoFrameIndex = (frameIndex + 1) % frames.length;
            
            const maxPacketSize = 1400; // Safe UDP packet size
            const jpegHeaderSize = 8;
            const rtpHeaderSize = 12;
            const maxPayloadSize = maxPacketSize - rtpHeaderSize - jpegHeaderSize;
            
            const totalFragments = Math.ceil(jpeg.length / maxPayloadSize);
            
            for (let fragmentIndex = 0; fragmentIndex < totalFragments; fragmentIndex++) {
                const start = fragmentIndex * maxPayloadSize;
                const end = Math.min(start + maxPayloadSize, jpeg.length);
                const fragmentData = jpeg.slice(start, end);
                
                const rtpHeader = Buffer.alloc(12);
                rtpHeader[0] = 0x80;
                rtpHeader[1] = 26; // JPEG payload type from SDP

                if (fragmentIndex === totalFragments - 1) {
                    rtpHeader[1] |= 0x80; // RTP marker bit on final packet of frame
                }
                
                rtpHeader.writeUInt16BE(seq & 0xFFFF, 2);
                rtpHeader.writeUInt32BE(rtpTimestamp & 0xFFFFFFFF, 4);
                rtpHeader.writeUInt32BE(ssrc, 8);

                const jpegHeader = Buffer.alloc(8);
                jpegHeader[0] = 0;
                jpegHeader[1] = (start >> 16) & 0xFF;
                jpegHeader[2] = (start >> 8) & 0xFF;
                jpegHeader[3] = start & 0xFF;
                jpegHeader[4] = 0;
                jpegHeader[5] = 80;
                jpegHeader[6] = frameWidth / 8;
                jpegHeader[7] = frameHeight / 8;

                const rtpPacket = Buffer.concat([rtpHeader, jpegHeader, fragmentData]);

                if (session.transportProtocol === 'tcp') {
                    this.writeInterleaved(session.socket, session.rtpChannel, rtpPacket);
                    packetsSent++;
                    octetsSent += rtpPacket.length;
                } else {
                    rtp.send(rtpPacket, 0, rtpPacket.length, session.clientRtpPort, session.clientAddress || '127.0.0.1', (err) => {
                        if (err) {
                            console.error('RTP send error:', err.message);
                        } else {
                            packetsSent++;
                            octetsSent += rtpPacket.length;
                        }
                    });
                }
                
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

            if (useTcp) {
                this.writeInterleaved(session.socket, session.rtcpChannel, rtcpSR);
            } else {
                rtcp.send(rtcpSR, 0, rtcpSR.length, session.clientRtcpPort, session.clientAddress || '127.0.0.1', (err) => {
                    if (err) {
                        console.error('RTCP send error:', err.message);
                    }
                });
            }
        };

        sendRTCP();
        sendFrame();
        
        session.rtpInterval = setInterval(sendFrame, frameInterval);
        session.rtcpInterval = setInterval(sendRTCP, 1000);
    }

    getUsernameFromSession(sessionId) {
        if (!sessionId) return null;
        const session = this.sessions.get(sessionId);
        return session ? session.username : null;
    }

    getPasswordFromSession(sessionId) {
        if (!sessionId) return null;
        const session = this.sessions.get(sessionId);
        return session ? session.password : null;
    }

    shouldLogCredentials(sessionId) {
        if (sessionId && this.sessions.has(sessionId)) {
            return !this.sessions.get(sessionId).credentialsLogged;
        }
        return false;
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
