
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { dbController } from './db_controller.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

app.get('/api/users', async (req, res) => {
  const users = await dbController.getUsers();
  res.json(users);
});

app.get('/api/groups', async (req, res) => {
  const groups = await dbController.getGroups();
  res.json(groups);
});

app.get('/api/sections', async (req, res) => {
  const sections = await dbController.getSections();
  res.json(sections);
});

app.get('/api/pages', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const user = { id: userId }; // Partial user object, controller will look it up or we should look it up here.
  // Controller looks it up in `data.users`.
  const pages = await dbController.getPages(user);
  res.json(pages);
});

app.get('/api/pages/:slug', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const user = { id: userId };
  try {
      const page = await dbController.getPage(req.params.slug, user);
      if (!page) return res.status(404).json({ error: 'Page not found' });
      res.json(page);
  } catch (e) {
      if (e.message === 'Permission denied') {
          return res.status(403).json({ error: 'Permission denied' });
      }
      res.status(500).json({ error: e.message });
  }
});

app.post('/api/pages/:slug', async (req, res) => {
  const { title, content, user, sectionId } = req.body;
  if (!user || !title || content === undefined) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const page = await dbController.savePage(req.params.slug, title, content, user, sectionId);
    res.json(page);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/pages/:slug/approve', async (req, res) => {
  const { index, user } = req.body;
  if (!user || index === undefined) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const page = await dbController.approveRevision(req.params.slug, index, user);
    res.json(page);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/pages/:slug/reject', async (req, res) => {
  const { index, user } = req.body;
  if (!user || index === undefined) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const page = await dbController.rejectRevision(req.params.slug, index, user);
    res.json(page);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.get('/api/pages/:slug/history', async (req, res) => {
  const history = await dbController.getHistory(req.params.slug);
  res.json(history);
});

app.post('/api/pages/:slug/revert', async (req, res) => {
  const { version, user } = req.body;
  if (!user || !version) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const page = await dbController.revert(req.params.slug, version, user);
  if (!page) return res.status(404).json({ error: 'Page or version not found' });
  res.json(page);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
