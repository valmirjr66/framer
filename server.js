const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const WATCH_IGNORE = /(^|[/\\])(\.git|node_modules)([/\\]|$)/;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

const HOT_RELOAD_PATH = '/__hot-reload';
const HOT_RELOAD_SCRIPT = `
<script>
    (() => {
        const source = new EventSource('${HOT_RELOAD_PATH}');
        source.onmessage = (event) => {
            if (event.data === 'reload') location.reload();
        };
    })();
</script>
`;

const sseClients = new Set();

function broadcastReload() {
    for (const res of sseClients) {
        res.write('data: reload\n\n');
    }
}

let reloadTimer = null;
fs.watch(ROOT, { recursive: true }, (eventType, filename) => {
    if (!filename || WATCH_IGNORE.test(filename)) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(broadcastReload, 100);
});

const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.split('?')[0]);

    if (requestPath === HOT_RELOAD_PATH) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });
        res.write('\n');
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
    }

    const filePath = path.join(ROOT, requestPath === '/' ? 'index.html' : requestPath);

    // Keep requests inside the project directory
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.html') {
            const html = data.toString().replace('</body>', `${HOT_RELOAD_SCRIPT}</body>`);
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] });
            res.end(html);
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Framer running at http://localhost:${PORT}`);
});
