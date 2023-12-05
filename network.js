const http = require('http');
const https = require('https');
const dns = require('dns');
const { performance } = require('perf_hooks');

// Drop your QuickNode Endpoint in here
const rpcUrl = 'https://docs-demo.quiknode.pro/';

function measureEthereumRequest(url, method, params = []) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      jsonrpc: "2.0",
      method: method,
      params: params,
      id: 1
    });

    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'http:' ? http : https;

    const startDns = performance.now();
    dns.lookup(urlObj.hostname, (err, address) => {
      if (err) return reject('DNS Lookup error: ' + err.message);
      const dnsResolutionTime = performance.now() - startDns;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      let connectTime, secureConnectTime;
      const startConnection = performance.now();

      const req = protocol.request(options, res => {
        const startTTFB = performance.now();
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const endTransfer = performance.now();
          const totalTime = endTransfer - startConnection;

          const tcpConnectionTime = connectTime ? connectTime - startConnection : null;
          const tlsHandshakeTime = secureConnectTime ? secureConnectTime - connectTime : null;
          const ttfb = startTTFB - startConnection;
          const serverProcessingTime = ttfb - (tcpConnectionTime || 0) - dnsResolutionTime;

          try {
            const response = JSON.parse(data);
            resolve({
              totalTime,
              dnsResolutionTime,
              tcpConnectionTime,
              tlsHandshakeTime,
              ttfb,
              serverProcessingTime,
              blockNumber: response.result,
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              data: response
            });
          } catch (error) {
            reject('Error parsing response: ' + error.message);
          }
        });
      });

      req.on('socket', socket => {
        socket.on('lookup', () => {
          socket.lookupTime = performance.now();
        });

        socket.on('connect', () => {
          connectTime = performance.now();
        });

        if (protocol === https) {
          socket.on('secureConnect', () => {
            secureConnectTime = performance.now();
          });
        }
      });

      req.on('error', error => {
        reject('Request error: ' + error.message);
      });

      req.write(postData);
      req.end();
    });
  });
}

const method = 'eth_blockNumber';

measureEthereumRequest(rpcUrl, method)
  .then(result => {
    console.log('Ethereum Block Number:', result.blockNumber);
    console.log('Timing Metrics:', result);
  })
  .catch(err => console.error('Error:', err));
