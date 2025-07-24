const brandConfigs = require('../config/brand-configs');

class BrandDetector {
  constructor() {
    this.brandConfigs = brandConfigs;
  }

  detectBrandByPort(port) {
    const portBrandMap = {
      80: 'hikvision',
      81: 'vstarcam', 
      37777: 'dahua',
      443: 'mobotix',
      10000: 'axis',
      8081: 'reolink'
    };
    
    return portBrandMap[port] || 'hikvision'; // default to hikvision
  }

  detectBrandByPath(url) {
    if (!url) return 'hikvision';
    
    const path = url.toLowerCase();
    
    if (path.includes('/hikvision') || path.includes('/hik')) {
      return 'hikvision';
    } else if (path.includes('/dahua') || path.includes('/dvr')) {
      return 'dahua';
    } else if (path.includes('/axis') || path.includes('/network')) {
      return 'axis';
    } else if (path.includes('/reolink') || path.includes('/rl')) {
      return 'reolink';
    } else if (path.includes('/mobotix') || path.includes('/mob')) {
      return 'mobotix';
    } else if (path.includes('/vstarcam') || path.includes('/vstar')) {
      return 'vstarcam';
    }
    
    return 'hikvision'; //default
  }

  detectBrandByUserAgent(userAgent) {
    if (!userAgent) return 'hikvision';
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('hikvision') || ua.includes('hik')) {
      return 'hikvision';
    } else if (ua.includes('dahua')) {
      return 'dahua';
    } else if (ua.includes('axis')) {
      return 'axis';
    } else if (ua.includes('reolink') || ua.includes('rl')) {
      return 'reolink';
    } else if (ua.includes('mobotix')) {
      return 'mobotix';
    } else if (ua.includes('vstarcam')) {
      return 'vstarcam';
    }
    
    return 'hikvision'; 
  }

  detectBrand(socket, request, url) {
    //first try to detect by port
    const port = socket.localPort;
    let brand = this.detectBrandByPort(port);
    
    //if we have a url, try to detect by path
    if (url) {
      const pathBrand = this.detectBrandByPath(url);
      if (pathBrand !== 'hikvision') {
        brand = pathBrand;
      }
    }
    
    //if we have a user-agent, try to detect by that
    if (request) {
      const lines = request.split('\r\n');
      const userAgentLine = lines.find(line => line.startsWith('User-Agent:'));
      if (userAgentLine) {
        const userAgent = userAgentLine.substring(12); 
        const uaBrand = this.detectBrandByUserAgent(userAgent);
        if (uaBrand !== 'hikvision') {
          brand = uaBrand;
        }
      }
    }
    
    return brand;
  }

  getBrandConfig(brand) {
    return this.brandConfigs[brand] || this.brandConfigs.hikvision;
  }

  generateNonce() {
    return Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  extractCSeq(request) {
    if (!request) return '1';
    
    const lines = request.split('\r\n');
    const cseqLine = lines.find(line => line.startsWith('CSeq:'));
    if (cseqLine) {
      const match = cseqLine.match(/CSeq:\s*(\d+)/);
      return match ? match[1] : '1';
    }
    
    return '1';
  }
}

module.exports = BrandDetector; 