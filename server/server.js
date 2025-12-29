
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

app.get('/api/pages', async (req, res) => {
  const pages = await dbController.getPages();
  res.json(pages);
});

app.get('/api/pages/:slug', async (req, res) => {
  const page = await dbController.getPage(req.params.slug);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json(page);
});

app.post('/api/pages/:slug', async (req, res) => {
  const { title, content, user } = req.body;
  if (!user || !title || content === undefined) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const page = await dbController.savePage(req.params.slug, title, content, user);
  res.json(page);
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
