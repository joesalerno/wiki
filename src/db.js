
// Seed data
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

const DB_KEY = 'react_wiki_db';

const getStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

export const db = {
  // Always try to get storage dynamically
  _load() {
    const storage = getStorage();
    if (!storage) return SEED_DATA;

    const raw = storage.getItem(DB_KEY);
    if (!raw) {
       storage.setItem(DB_KEY, JSON.stringify(SEED_DATA));
       return SEED_DATA;
    }
    return JSON.parse(raw);
  },

  _save(data) {
    const storage = getStorage();
    if (storage) {
      storage.setItem(DB_KEY, JSON.stringify(data));
    }
  },

  init() {
    // Just ensure seed data exists
    this._load();
  },

  getUsers() {
    return this._load().users;
  },

  getUser(id) {
    return this._load().users.find(u => u.id === id);
  },

  getGroups() {
    return this._load().groups;
  },

  getPages() {
    const data = this._load();
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

  getPage(slug) {
    const data = this._load();
    const page = data.pages[slug];
    if (!page) return null;

    return {
      ...page,
      currentRevision: page.revisions[0]
    };
  },

  savePage(slug, title, content, user) {
    const data = this._load();
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

    this._save(data);
    return page;
  },

  getHistory(slug) {
     const data = this._load();
     const page = data.pages[slug];
     return page ? page.revisions : [];
  },

  revert(slug, version, user) {
     const data = this._load();
     const page = data.pages[slug];
     if(!page) return null;

     const targetRev = page.revisions.find(r => r.version === version);
     if(!targetRev) return null;

     this.savePage(slug, page.title, targetRev.content, user);
     return this.getPage(slug);
  }
};
