const { spawn } = require('child_process');
const readline = require('readline');
const databaseLogger = require('../utils/database-logger');

const DEFAULT_CONTAINER = process.env.COWRIE_CONTAINER_NAME || 'cowrie-services';
const DEFAULT_LOG_PATH = process.env.COWRIE_LOG_PATH || '/cowrie/cowrie-git/var/log/cowrie/cowrie.json';
const PYTHON_INTERPRETER = process.env.COWRIE_PY || 'python3';

function mapCowrieToLogEvent(event) {
  const eventId = event.eventid || event.event || '';
  const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();

  const base = {
    service: 'cowrie',
    log_level: 'info',
    timestamp,
    ip_address: event.src_ip || event.srcIP || null,
    port: event.src_port || event.srcPort || null,
    session_id: event.session || event.sessionid || null,
    username: event.username || null,
    password: event.password || null,
    raw_data: event,
    brand: null
  };

  switch (eventId) {
    case 'cowrie.session.connect':
      return { ...base, event_type: 'session_start', message: `Session started from ${base.ip_address}:${base.port}` };
    case 'cowrie.session.closed':
      return { ...base, event_type: 'session_end', message: `Session closed for ${base.ip_address}` };
    case 'cowrie.login.failed':
      return { ...base, event_type: 'auth_failure', log_level: 'warn', message: `Login failed for user ${base.username || 'unknown'}` };
    case 'cowrie.login.success':
      return { ...base, event_type: 'login_success', message: `Login success for user ${base.username || 'unknown'}` };
    case 'cowrie.command.input':
      return { ...base, event_type: 'command_execution', message: event.input ? `Command: ${event.input}` : 'Command input', raw_data: { ...event, command: event.input } };
    case 'cowrie.command.failed':
      return { ...base, event_type: 'command_execution', log_level: 'error', message: event.input ? `Command failed: ${event.input}` : 'Command failed', raw_data: { ...event, command: event.input } };
    case 'cowrie.session.file_download':
      return { ...base, event_type: 'download_attempt', message: event.url ? `Download from ${event.url}` : 'File download', raw_data: { ...event, file_path: event.outfile, file_size: event.size } };
    case 'cowrie.session.file_upload':
      return { ...base, event_type: 'upload_attempt', message: event.filename ? `Upload ${event.filename}` : 'File upload', raw_data: { ...event, file_path: event.filename, file_size: event.size } };
    case 'cowrie.client.version':
    case 'cowrie.client.fingerprint':
      return { ...base, event_type: 'service_event', message: eventId === 'cowrie.client.version' ? `Client version: ${event.version || ''}` : `Client fingerprint: ${event.kexAlgs || ''}` };
    case 'cowrie.direct-tcpip.request':
      return { ...base, event_type: 'suspicious_activity', log_level: 'warn', message: `Direct TCPIP request to ${event.dst_ip || ''}:${event.dst_port || ''}` };
    case 'cowrie.alert':
      return { ...base, event_type: 'alert', log_level: (event.severity && event.severity >= 3) ? 'error' : 'warn', message: event.message || 'Cowrie alert', raw_data: { ...event, threat_level: event.severity } };
    default:
      return { ...base, event_type: 'service_event', message: eventId || 'cowrie_event' };
  }
}

function startCowrieIngestor() {
  const container = DEFAULT_CONTAINER;
  const preferredPath = DEFAULT_LOG_PATH;
 
  // Python script selects the first existing path and follows it
  const pyFollower = `
import os, sys, time
candidates = [${JSON.stringify(preferredPath)}, '/cowrie/var/log/cowrie/cowrie.json']
p = None
while True:
    for c in candidates:
        if os.path.exists(c):
            p = c
            break
    if p:
        break
    time.sleep(1)
print('[COWRIE_INGESTOR] Using log path:', p)
f = open(p, 'r', encoding='utf-8', errors='ignore')
f.seek(0, 2)
while True:
    line = f.readline()
    if not line:
        time.sleep(0.5)
        continue
    sys.stdout.write(line)
    sys.stdout.flush()
`.trim();
 
  const execArgs = ['exec', '-i', container, PYTHON_INTERPRETER, '-u', '-c', pyFollower];

  let child = null;

  const start = () => {
    try {
      child = spawn('docker', execArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      console.error('[COWRIE_INGESTOR] Failed to spawn docker exec:', err.message);
      scheduleRestart();
      return;
    }

    const rl = readline.createInterface({ input: child.stdout });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let evt = null;
      try {
        evt = JSON.parse(trimmed);
      } catch (_) {
        return;
      }

      try {
        const mapped = mapCowrieToLogEvent(evt);
        await databaseLogger.logEvent(mapped);
      } catch (e) {
        console.error('[COWRIE_INGESTOR] Error logging event:', e.message);
      }
    });

    child.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error('[COWRIE_INGESTOR][stderr]', msg);
    });

    child.on('exit', (code, signal) => {
      console.warn(`[COWRIE_INGESTOR] docker exec exited code=${code} signal=${signal}`);
      rl.close();
      scheduleRestart();
    });

    console.log(`[COWRIE_INGESTOR] Started following Cowrie JSON log in ${container}`);
  };

  let restartTimer = null;
  const scheduleRestart = () => {
    if (restartTimer) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      start();
    }, 5000);
  };

  start();
}

module.exports = { startCowrieIngestor }; 