const brandConfigs = {
  hikvision: {
    name: "Hikvision DVR rtspd",
    server: "Hikvision DVR rtspd",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 200 OK\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN, PAUSE\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 200 OK\r\nCSeq: ${cseq} OPTIONS\r\nPublic: OPTIONS, DESCRIBE, PLAY, PAUSE, SETUP, TEARDOWN, SET_PARAMETER, GET_PARAMETER\r\nDate: ${new Date().toUTCString()}\r\n\r\n`
      },
      unauthorized: (cseq) => `RTSP/1.0 401 Unauthorized\r\nCSeq: ${cseq}\r\nWWW-Authenticate: Basic realm="/"\r\n\r\n`
    }
  },
  
  dahua: {
    name: "Dahua IP camera rtspd",
    server: "Dahua Rtsp Server",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 405 Method Not Allowed\r\nServer: Dahua Rtsp Server\r\nContent-Length: 0\r\nCSeq: 0\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 405 Method Not Allowed\r\nServer: Dahua Rtsp Server\r\nContent-Length: 0\r\nCSeq: ${cseq}\r\n\r\n`
      },
      unauthorized: (cseq) => `RTSP/1.0 401 Unauthorized\r\nCSeq: ${cseq}\r\nWWW-Authenticate: Basic realm="device"\r\nServer: Dahua Rtsp Server\r\nContent-Length: 0\r\n\r\n`
    }
  },
  
  axis: {
    name: "Axis 207W Webcam rtspd",
    server: "Axis Rtsp Server",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 200 OK\r\nPublic: DESCRIBE, GET_PARAMETER, PAUSE, PLAY, SETUP, TEARDOWN\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: DESCRIBE, GET_PARAMETER, PAUSE, PLAY, SETUP, TEARDOWN\r\n\r\n`
      },
      unauthorized: (cseq) => `RTSP/1.0 401 Unauthorized\r\nCSeq: ${cseq}\r\nWWW-Authenticate: Basic realm="device"\r\n\r\n`
    }
  },
  
  reolink: {
    name: "Reolink IP camera rtspd",
    server: "Reolink Rtsp Server",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 200 OK\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n`
      },
      unauthorized: (cseq) => `RTSP/1.0 401 Unauthorized\r\nCSeq: ${cseq}\r\nWWW-Authenticate: Basic realm="device"\r\n\r\n`
    }
  },
  
  mobotix: {
    name: "Mobotix IP camera rtspd",
    server: "Mobotix Rtsp Server",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 200 OK\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n`
      },
      unauthorized: (cseq) => `RTSP/1.0 401 Unauthorized\r\nCSeq: ${cseq}\r\nWWW-Authenticate: Basic realm="device"\r\n\r\n`
    }
  },
  
  vstarcam: {
    name: "Vstarcam IP camera rtspd",
    server: "Vstarcam Rtsp Server",
    patterns: {
      options: {
        pattern1: "RTSP/1.0 200 OK\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n",
        pattern2: (cseq) => `RTSP/1.0 200 OK\r\nCSeq: ${cseq}\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN\r\n\r\n`
      },
      unauthorized: (cseq) => `RTSP/1.0 401 Unauthorized\r\nCSeq: ${cseq}\r\nWWW-Authenticate: Basic realm="device"\r\n\r\n`
    }
  }
};

module.exports = brandConfigs;
