
const SEED_DATA = {
  users: [
    { id: 'admin', name: 'Admin User', groups: ['admin'] },
    { id: 'editor', name: 'Editor User', groups: ['editor'] },
    { id: 'viewer', name: 'Viewer User', groups: ['viewer'] }
  ],
  groups: {
    admin: { permissions: ['read', 'write', 'delete', 'manage'] },
    editor: { permissions: ['read', 'write'] },
    viewer: { permissions: ['read'] }
  },
  pages: {
    'home': {
      slug: 'home',
      title: 'Home',
      revisions: [
        {
          version: 1,
          content: "# Welcome to the Wiki\n\nThis is a minimal, polished React Wiki.\n\n- **Features**:\n  - Versioning\n  - History\n  - Groups & Permissions\n  - No dependencies\n\nEnjoy!",
          authorId: 'admin',
          timestamp: Date.now()
        }
      ]
    }
  }
};

const DB_KEY = 'wiki_db_v1';

class Database {
  constructor() {
    this.data = this._load();
  }

  _load() {
    const stored = localStorage.getItem(DB_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    this._save(SEED_DATA);
    return SEED_DATA;
  }

  _save(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    this.data = data;
  }

  getUsers() {
    return this.data.users;
  }

  getGroups() {
    return this.data.groups;
  }

  getPages() {
    return Object.values(this.data.pages).map(p => ({
      slug: p.slug,
      title: p.title,
      latest: p.revisions[0]
    }));
  }

  getPage(slug) {
    return this.data.pages[slug] || null;
  }

  createPage(title, user) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (this.data.pages[slug]) {
      throw new Error('Page already exists');
    }

    const newPage = {
      slug,
      title,
      revisions: [
        {
          version: 1,
          content: `# ${title}\n\nNew page.`,
          authorId: user.id,
          timestamp: Date.now()
        }
      ]
    };

    const newData = {
        ...this.data,
        pages: {
            ...this.data.pages,
            [slug]: newPage
        }
    };
    this._save(newData);
    return newPage;
  }

  savePage(slug, content, user) {
    const page = this.data.pages[slug];
    if (!page) throw new Error('Page not found');

    const latestVer = page.revisions[0].version;
    const newRevision = {
      version: latestVer + 1,
      content,
      authorId: user.id,
      timestamp: Date.now()
    };

    const updatedPage = {
      ...page,
      revisions: [newRevision, ...page.revisions]
    };

    const newData = {
      ...this.data,
      pages: {
        ...this.data.pages,
        [slug]: updatedPage
      }
    };
    this._save(newData);
    return updatedPage;
  }

  revertTo(slug, version, user) {
      const page = this.data.pages[slug];
      if (!page) throw new Error('Page not found');

      const targetRevision = page.revisions.find(r => r.version === version);
      if (!targetRevision) throw new Error('Version not found');

      // Revert creates a NEW version with old content
      return this.savePage(slug, targetRevision.content, user);
  }
}

export const db = new Database();
