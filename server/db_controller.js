
import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.resolve('wiki.json');

const SEED_DATA = {
  users: [
    { id: 'u1', name: 'Alice (Admin)', groups: ['admin'] },
    { id: 'u2', name: 'Bob (Editor)', groups: ['editor'] },
    { id: 'u3', name: 'Charlie (Viewer)', groups: ['viewer'] },
  ],
  groups: {
    admin: { permissions: ['read', 'write', 'delete', 'manage'] },
    editor: { permissions: ['read', 'write'] },
    viewer: { permissions: ['read'] },
  },
  pages: {
    'home': {
      id: 'home',
      slug: 'home',
      title: 'Home',
      revisions: [
        {
          version: 1,
          content: "# Welcome to React Wiki\n\nThis is a minimal, dependency-free Wiki component.\n\n*   Secure\n*   Versioned\n*   Fast\n\nTry editing this page!",
          authorId: 'u1',
          timestamp: Date.now()
        }
      ]
    }
  }
};

async function loadData() {
  try {
    await fs.access(DB_PATH);
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    // If file doesn't exist, create it with seed data
    await saveData(SEED_DATA);
    return SEED_DATA;
  }
}

async function saveData(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

export const dbController = {
  async getUsers() {
    const data = await loadData();
    return data.users;
  },

  async getGroups() {
    const data = await loadData();
    return data.groups;
  },

  async getPages() {
    const data = await loadData();
    return Object.values(data.pages).map(p => {
       const head = p.revisions[0];
       return {
         slug: p.slug,
         title: p.title,
         updatedAt: head.timestamp,
         authorId: head.authorId
       };
    });
  },

  async getPage(slug) {
    const data = await loadData();
    const page = data.pages[slug];
    if (!page) return null;
    return {
      ...page,
      currentRevision: page.revisions[0]
    };
  },

  async savePage(slug, title, content, user) {
    const data = await loadData();
    let page = data.pages[slug];

    const newRevision = {
      version: page ? page.revisions[0].version + 1 : 1,
      content,
      authorId: user.id,
      timestamp: Date.now()
    };

    if (!page) {
      page = {
        id: slug,
        slug,
        title,
        revisions: []
      };
      data.pages[slug] = page;
    } else {
        page.title = title;
    }

    page.revisions.unshift(newRevision);

    await saveData(data);
    return page;
  },

  async getHistory(slug) {
     const data = await loadData();
     const page = data.pages[slug];
     return page ? page.revisions : [];
  },

  async revert(slug, version, user) {
     const data = await loadData();
     const page = data.pages[slug];
     if(!page) return null;

     const targetRev = page.revisions.find(r => r.version === parseInt(version));
     if(!targetRev) return null;

     // Save as new revision
     return await this.savePage(slug, page.title, targetRev.content, user);
  }
};
