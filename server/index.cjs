const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3001;
const DB_FILE = path.join(__dirname, 'db.json');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Helper to read DB
const readDB = () => {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
};

// Helper to write DB
const writeDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // --- API Routes ---

  // GET /api/init: Fetch everything (sections, groups, pages list)
  if (method === 'GET' && pathname === '/api/init') {
    const db = readDB();
    if (!db) {
      res.writeHead(500, CORS_HEADERS);
      res.end('Database error');
      return;
    }
    const responseData = {
      groups: db.groups,
      sections: db.sections,
      pages: db.pages, // Minimal page info
    };
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify(responseData));
    return;
  }

  // GET /api/page/:id: Fetch page details + revisions
  if (method === 'GET' && pathname.startsWith('/api/page/')) {
    const pageId = pathname.split('/').pop();
    const db = readDB();
    const page = db.pages.find(p => p.id === pageId);
    if (!page) {
      res.writeHead(404, CORS_HEADERS);
      res.end('Page not found');
      return;
    }
    const revisions = db.revisions.filter(r => r.pageId === pageId).sort((a, b) => b.version - a.version);
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ page, revisions }));
    return;
  }

  // POST /api/page: Create/Update page
  if (method === 'POST' && pathname === '/api/page') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { id, sectionId, title, content, author, status } = JSON.parse(body);
        const db = readDB();

        let pageId = id;
        let page = null;

        // If ID provided, update existing
        if (id) {
            page = db.pages.find(p => p.id === id);
        }

        // Create new page if not exists
        if (!page) {
            pageId = 'p' + Date.now();
            page = { id: pageId, sectionId, title, latestVersion: 0 }; // Version 0 initially
            db.pages.push(page);
        }

        const newVersion = page.latestVersion + 1;

        // Create revision
        const revision = {
            id: 'r' + Date.now(),
            pageId: pageId,
            version: newVersion,
            content,
            author,
            status: status || 'published', // 'published' or 'pending'
            timestamp: Date.now()
        };

        db.revisions.push(revision);

        // Update page latest version ONLY if published
        if (status === 'published') {
            page.latestVersion = newVersion;
        }
        // If pending, we DO NOT update page.latestVersion yet.
        // The revision is saved, but the "current" version remains the old one.

        writeDB(db);

        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ page, revision }));
      } catch (e) {
        console.error(e);
        res.writeHead(500, CORS_HEADERS);
        res.end('Error saving page');
      }
    });
    return;
  }

  // POST /api/approve: Approve a revision
  if (method === 'POST' && pathname === '/api/approve') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
          try {
              const { revisionId } = JSON.parse(body);
              const db = readDB();
              const rev = db.revisions.find(r => r.id === revisionId);
              if (rev) {
                  rev.status = 'published';

                  // Update page latestVersion to this approved version
                  const page = db.pages.find(p => p.id === rev.pageId);
                  if (page && rev.version > page.latestVersion) {
                      page.latestVersion = rev.version;
                  }

                  writeDB(db);
                  res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
                  res.end(JSON.stringify({ success: true }));
              } else {
                  res.writeHead(404, CORS_HEADERS);
                  res.end('Revision not found');
              }
          } catch (e) {
              res.writeHead(500, CORS_HEADERS);
              res.end('Error approving');
          }
      });
      return;
  }

  // POST /api/section: Create/Update section (Permissions)
  if (method === 'POST' && pathname === '/api/section') {
      // Implement if needed for admin settings
  }

  res.writeHead(404, CORS_HEADERS);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
