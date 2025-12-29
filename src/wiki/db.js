// src/wiki/db.js

const STORAGE_KEY = 'wiki_db_v1';

const INITIAL_DATA = {
  users: [
    { id: 'u1', name: 'Admin User', groups: ['admin'] },
    { id: 'u2', name: 'Editor User', groups: ['editor'] },
    { id: 'u3', name: 'Viewer User', groups: ['viewer'] },
  ],
  groups: ['admin', 'editor', 'viewer'],
  sections: [
    {
      id: 's1',
      name: 'General',
      permissions: { view: ['viewer', 'editor', 'admin'], edit: ['editor', 'admin'], publish: ['editor', 'admin'] },
      requireReview: false
    },
    {
      id: 's2',
      name: 'Engineering',
      permissions: { view: ['editor', 'admin'], edit: ['editor', 'admin'], publish: ['admin'] },
      requireReview: true
    }
  ],
  pages: [
    {
      id: 'p1',
      sectionId: 's1',
      title: 'Welcome',
      currentVersion: 1,
      latestDraftVersion: null,
      status: 'published'
    },
    {
      id: 'p2',
      sectionId: 's2',
      title: 'Architecture',
      currentVersion: 1,
      latestDraftVersion: null,
      status: 'published'
    }
  ],
  versions: [
    {
      id: 'v1_p1',
      pageId: 'p1',
      versionNumber: 1,
      content: '# Welcome to the Wiki\n\nThis is the start of something great.',
      authorId: 'u1',
      timestamp: Date.now(),
      status: 'published'
    },
    {
      id: 'v1_p2',
      pageId: 'p2',
      versionNumber: 1,
      content: '# System Architecture\n\nOur system is built with React.',
      authorId: 'u2',
      timestamp: Date.now(),
      status: 'published'
    }
  ]
};

export class WikiDB {
  constructor() {
    this.data = this.load();
    this.currentUser = this.data.users[0]; // Default to Admin
  }

  load() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    this.save(INITIAL_DATA);
    return INITIAL_DATA;
  }

  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    this.data = data;
  }

  // Auth simulation
  setCurrentUser(userId) {
    const user = this.data.users.find(u => u.id === userId);
    if (user) this.currentUser = user;
  }

  getUsers() {
    return this.data.users;
  }

  // Permissions
  checkPermission(sectionId, action) {
    // action: 'view', 'edit', 'publish'
    const section = this.data.sections.find(s => s.id === sectionId);
    if (!section) return false;
    const allowedGroups = section.permissions[action] || [];
    return this.currentUser.groups.some(g => allowedGroups.includes(g));
  }

  // Reads
  getSections() {
    return this.data.sections.filter(s => this.checkPermission(s.id, 'view'));
  }

  getPages(sectionId) {
    if (sectionId && !this.checkPermission(sectionId, 'view')) return [];

    let pages = this.data.pages;
    if (sectionId) {
      pages = pages.filter(p => p.sectionId === sectionId);
    } else {
        // Filter by all sections user can view
        const viewableSections = this.data.sections.filter(s => this.checkPermission(s.id, 'view')).map(s => s.id);
        pages = pages.filter(p => viewableSections.includes(p.sectionId));
    }
    return pages;
  }

  getPage(id) {
    const page = this.data.pages.find(p => p.id === id);
    if (!page) return null;
    if (!this.checkPermission(page.sectionId, 'view')) return null;

    // Get latest published version content
    const version = this.data.versions.find(v => v.pageId === id && v.versionNumber === page.currentVersion);
    return { ...page, content: version ? version.content : '', latestRevision: version };
  }

  getHistory(pageId) {
    const page = this.data.pages.find(p => p.id === pageId);
    if (!page || !this.checkPermission(page.sectionId, 'view')) return [];
    return this.data.versions.filter(v => v.pageId === pageId).sort((a, b) => b.versionNumber - a.versionNumber);
  }

  // Writes
  savePage(pageId, content, title) {
    const page = this.data.pages.find(p => p.id === pageId);
    if (!page) return { error: 'Page not found' };

    const section = this.data.sections.find(s => s.id === page.sectionId);
    const canEdit = this.checkPermission(page.sectionId, 'edit');

    if (!canEdit) return { error: 'Permission denied' };

    const canPublish = this.checkPermission(page.sectionId, 'publish');
    const needsReview = section.requireReview && !canPublish;

    const newVersionNumber = page.currentVersion + 1; // Simplification: assume linear versioning even for drafts for now, or just separate drafts
    // Actually, if it needs review, we shouldn't bump currentVersion yet.

    // Logic:
    // If needs review -> status = pending_review.
    // If direct publish -> status = published, update page.currentVersion.

    const newVersion = {
      id: `v${Date.now()}_${pageId}`,
      pageId,
      versionNumber: newVersionNumber, // This is tricky if multiple drafts. Let's just increment for now.
      content,
      authorId: this.currentUser.id,
      timestamp: Date.now(),
      status: needsReview ? 'pending_review' : 'published'
    };

    const newData = { ...this.data };
    newData.versions.push(newVersion);

    const pageIndex = newData.pages.findIndex(p => p.id === pageId);
    const updatedPage = { ...newData.pages[pageIndex] };
    updatedPage.title = title;

    if (!needsReview) {
      updatedPage.currentVersion = newVersionNumber;
    } else {
        updatedPage.latestDraftVersion = newVersionNumber;
        updatedPage.status = 'pending_review';
    }

    newData.pages[pageIndex] = updatedPage;
    this.save(newData);
    return { success: true, version: newVersion };
  }

  createPage(sectionId, title, content) {
      if (!this.checkPermission(sectionId, 'edit')) return { error: 'Permission denied' };

      const newPageId = `p${Date.now()}`;
      const section = this.data.sections.find(s => s.id === sectionId);
      const canPublish = this.checkPermission(sectionId, 'publish');
      const needsReview = section.requireReview && !canPublish;

      const newVersion = {
        id: `v${Date.now()}_${newPageId}`,
        pageId: newPageId,
        versionNumber: 1,
        content,
        authorId: this.currentUser.id,
        timestamp: Date.now(),
        status: needsReview ? 'pending_review' : 'published'
      };

      const newPage = {
          id: newPageId,
          sectionId,
          title,
          currentVersion: needsReview ? 0 : 1, // 0 means no published version
          latestDraftVersion: needsReview ? 1 : null,
          status: needsReview ? 'pending_review' : 'published'
      };

      const newData = { ...this.data };
      newData.pages.push(newPage);
      newData.versions.push(newVersion);
      this.save(newData);
      return { success: true, page: newPage };
  }
}

export const db = new WikiDB();
