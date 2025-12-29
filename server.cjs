const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const DB_FILE = path.join(__dirname, 'db.json');

// In-memory data store for users (static for now)
const users = {
  admin: { username: 'admin', group: 'admin' },
  editor: { username: 'editor', group: 'editor' },
  viewer: { username: 'viewer', group: 'viewer' },
};

const groups = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

// Helper to load DB
const loadDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    return { pages: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    console.error('Error reading DB:', err);
    return { pages: {} };
  }
};

// Helper to save DB
const saveDB = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing DB:', err);
  }
};

// Load initial state
let db = loadDB();

const getBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
};

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean); // ['api', 'pages', ...]

  if (pathParts[0] !== 'api') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  try {
    // GET /api/pages
    if (req.method === 'GET' && pathParts[1] === 'pages' && pathParts.length === 2) {
      const pageList = Object.values(db.pages).map((p) => {
        const latest = p.versions[p.versions.length - 1];
        return {
          slug: p.slug,
          title: p.title,
          latestVersion: latest.version,
          updatedAt: latest.timestamp,
          updatedBy: latest.author,
        };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pageList));
      return;
    }

    // GET /api/pages/:slug
    if (req.method === 'GET' && pathParts[1] === 'pages' && pathParts.length === 3) {
      const slug = pathParts[2];
      const page = db.pages[slug];
      if (!page) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Page not found' }));
        return;
      }
      const latest = page.versions[page.versions.length - 1];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...latest, title: page.title, slug: page.slug }));
      return;
    }

    // POST /api/pages (Create new page)
    if (req.method === 'POST' && pathParts[1] === 'pages' && pathParts.length === 2) {
        const body = await getBody(req);
        const { slug, title, content, author } = body;

        if (!slug || !title || !content || !author) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing fields' }));
            return;
        }

        // Check permissions
        const user = users[author];
        if (!user || !groups[user.group].includes('write')) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden' }));
            return;
        }

        if (db.pages[slug]) {
             res.writeHead(409, { 'Content-Type': 'application/json' });
             res.end(JSON.stringify({ error: 'Page already exists' }));
             return;
        }

        const newPage = {
            slug,
            title,
            versions: [
                {
                    version: 1,
                    content,
                    author,
                    timestamp: Date.now()
                }
            ]
        };
        db.pages[slug] = newPage;
        saveDB(db);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newPage));
        return;
    }


    // POST /api/pages/:slug (Update page / New Version)
    if (req.method === 'POST' && pathParts[1] === 'pages' && pathParts.length === 3) {
      const slug = pathParts[2];
      const page = db.pages[slug];
      if (!page) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Page not found' }));
        return;
      }

      const body = await getBody(req);
      const { content, author, title } = body; // Allow title update too

      // Check permissions
      const user = users[author];
      if (!user || !groups[user.group].includes('write')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }

      if (title) page.title = title;

      const latestVersion = page.versions[page.versions.length - 1].version;
      const newVersion = {
        version: latestVersion + 1,
        content: content || page.versions[page.versions.length - 1].content,
        author: author || 'anonymous',
        timestamp: Date.now(),
      };
      page.versions.push(newVersion);
      saveDB(db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...newVersion, title: page.title, slug: page.slug }));
      return;
    }

    // GET /api/pages/:slug/history
    if (req.method === 'GET' && pathParts[1] === 'pages' && pathParts.length === 4 && pathParts[3] === 'history') {
      const slug = pathParts[2];
      const page = db.pages[slug];
      if (!page) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Page not found' }));
        return;
      }
      // Return metadata only for history list
      const history = page.versions.map(v => ({
          version: v.version,
          timestamp: v.timestamp,
          author: v.author
      })).reverse(); // Newest first

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(history));
      return;
    }

     // GET /api/pages/:slug/version/:v
    if (req.method === 'GET' && pathParts[1] === 'pages' && pathParts.length === 6 && pathParts[3] === 'version') {
        const slug = pathParts[2];
        const v = parseInt(pathParts[5]);
        const page = db.pages[slug];

        if (!page) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Page not found' }));
            return;
        }

        const versionData = page.versions.find(ver => ver.version === v);
        if (!versionData) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Version not found' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...versionData, title: page.title, slug: page.slug }));
        return;
    }

    // POST /api/login
    if (req.method === 'POST' && pathParts[1] === 'login') {
      const body = await getBody(req);
      const { username } = body;
      const user = users[username];

      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid user' }));
        return;
      }

      const permissions = groups[user.group];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ user: { ...user, permissions } }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
