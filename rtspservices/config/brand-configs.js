const brandConfigs = {
  hikvision: {
    name: "Hikvision DVR rtspd",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 200 OK\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN, PAUSE\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 200 OK\r\nCSeq: ${cseq} OPTIONS\r\nPublic: OPTIONS, DESCRIBE, PLAY, PAUSE, SETUP, TEARDOWN, SET_PARAMETER, GET_PARAMETER\r\nDate: ${new Date().toUTCString()}\r\n\r\n`
      },
      unauthorized: (nonce) => `RTSP/1.0 401 Unauthorized\r\nWWW-Authenticate: Digest realm="Hikvision", nonce="${nonce}", stale="FALSE"\r\nWWW-Authenticate: Basic realm="/"\r\n\r\n`,
      server: "Hikvision DVR rtspd"
    }
  },
  
  dahua: {
    name: "Dahua IP camera rtspd",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 405 Method Not Allowed\r\nServer: Dahua Rtsp Server\r\nContent-Length: 0\r\nCSeq: 0\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 405 Method Not Allowed\r\nServer: Dahua Rtsp Server\r\nContent-Length: 0\r\nCSeq: ${cseq}\r\n\r\n`
      },
      unauthorized: (nonce) => `RTSP/1.0 401 Unauthorized\r\nWWW-Authenticate: Basic realm="device"\r\nServer: Dahua Rtsp Server\r\nContent-Length: 0\r\n\r\n`,
      server: "Dahua Rtsp Server"
    }
  },
  
  axis: {
    name: "Axis 207W Webcam rtspd",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 200 OK\r\nPublic: DESCRIBE, GET_PARAMETER, PAUSE, PLAY, SETUP, TEARDOWN\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: DESCRIBE, GET_PARAMETER, PAUSE, PLAY, SETUP, TEARDOWN\r\n\r\n`
      },
      unauthorized: (nonce) => `RTSP/1.0 401 Unauthorized\r\nWWW-Authenticate: Basic realm="device"\r\n\r\n`,
      server: "Axis Rtsp Server"
    }
  },
  
  reolink: {
    name: "Reolink IP camera rtspd",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 200 OK\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n`
      },
      unauthorized: (nonce) => `RTSP/1.0 401 Unauthorized\r\nWWW-Authenticate: Basic realm="device"\r\n\r\n`,
      server: "Reolink Rtsp Server"
    }
  },
  
  mobotix: {
    name: "Mobotix IP camera rtspd",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 200 OK\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n`
      },
      unauthorized: (nonce) => `RTSP/1.0 401 Unauthorized\r\nWWW-Authenticate: Basic realm="device"\r\n\r\n`,
      server: "Mobotix Rtsp Server"
    }
  },
  
  vstarcam: {
    name: "Vstarcam IP camera rtspd",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 200 OK\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n`
      },
      unauthorized: (nonce) => `RTSP/1.0 401 Unauthorized\r\nWWW-Authenticate: Basic realm="device"\r\n\r\n`,
      server: "Vstarcam Rtsp Server"
    }
  }
};

module.exports = brandConfigs; 