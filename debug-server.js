import http from 'http';
import fs from 'fs';
import path from 'path';

const server = http.createServer((req, res) => {
  let filePath = req.url;
  if (req.url === '/') {
    filePath = '/index.html';
  }

  // Prevent directory traversal
  if (filePath.includes('../')) {
    res.writeHead(403);
    res.end('Access denied');
    return;
  }

  const fullPath = path.join(process.cwd(), filePath);

  fs.stat(fullPath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    if (stats.isDirectory()) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('Directory listing not supported');
      return;
    }

    // MIME types mapping
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.woff': 'application/font-woff',
      '.woff2': 'application/font-woff2',
      '.ttf': 'Application/font-ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'application/font-otf',
      '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
        return;
      }

      // Add cache-busting headers to prevent browser caching of static files
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };

      res.writeHead(200, headers);
      res.end(data);
    });
  });
});

server.listen(3001, () => {
  console.log('Debug server running on http://localhost:3001');
  console.log('Proper MIME types enabled for JavaScript modules');
});