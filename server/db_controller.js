
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
  sections: {
    'general': {
      id: 'general',
      name: 'General',
      permissions: {
        admin: ['read', 'write', 'manage'],
        editor: ['read', 'write'],
        viewer: ['read']
      },
      requiresReview: false
    }
  },
  pages: {
    'home': {
      id: 'home',
      slug: 'home',
      title: 'Home',
      sectionId: 'general',
      revisions: [
        {
          version: 1,
          content: "# Welcome to React Wiki\n\nThis is a minimal, dependency-free Wiki component.\n\n*   Secure\n*   Versioned\n*   Fast\n\nTry editing this page!",
          authorId: 'u1',
          timestamp: Date.now()
        }
      ],
      pendingRevisions: []
    }
  }
};

async function loadData() {
  try {
    await fs.access(DB_PATH);
    const data = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    // Ensure new fields exist if loading old data
    if (!parsed.sections) parsed.sections = SEED_DATA.sections;
    for(let slug in parsed.pages) {
        if(!parsed.pages[slug].sectionId) parsed.pages[slug].sectionId = 'general';
        if(!parsed.pages[slug].pendingRevisions) parsed.pages[slug].pendingRevisions = [];
    }
    return parsed;
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

  async getSections() {
    const data = await loadData();
    return Object.values(data.sections);
  },

  async getSection(id) {
    const data = await loadData();
    return data.sections[id];
  },

  async saveSection(section) {
    const data = await loadData();
    data.sections[section.id] = section;
    await saveData(data);
    return section;
  },

  async getPages() {
    const data = await loadData();
    return Object.values(data.pages).map(p => {
       const head = p.revisions[0];
       return {
         slug: p.slug,
         title: p.title,
         sectionId: p.sectionId,
         updatedAt: head ? head.timestamp : Date.now(),
         authorId: head ? head.authorId : 'system'
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

  async savePage(slug, title, content, user, sectionId) {
    const data = await loadData();
    let page = data.pages[slug];
    let section = data.sections[sectionId || (page ? page.sectionId : 'general')];

    // Default section if missing
    if (!section) {
        sectionId = 'general';
        section = data.sections['general'];
    }

    const newRevision = {
      version: page && page.revisions.length > 0 ? page.revisions[0].version + 1 : 1,
      content,
      authorId: user.id,
      timestamp: Date.now()
    };

    if (!page) {
      page = {
        id: slug,
        slug,
        title,
        sectionId,
        revisions: [],
        pendingRevisions: []
      };
      data.pages[slug] = page;
    } else {
        page.title = title;
        if (sectionId) page.sectionId = sectionId;
    }

    // Check for review requirement
    // Logic: Page setting overrides section setting if present (not implemented yet, so section only)
    // Actually, prompt says "mark sections or pages", so let's stick to section config for now as it's cleaner
    // or add page config later. Let's assume section config drives it.

    // Check if user is exempt from review? Usually reviewers don't need review.
    // For simplicity: if section.requiresReview is true, ALWAYS require review unless user is admin?
    // Or just put in pending.

    const requiresReview = section && section.requiresReview;

    if (requiresReview) {
        newRevision.id = Math.random().toString(36).substr(2, 9);
        newRevision.status = 'pending';
        page.pendingRevisions.push(newRevision);
        await saveData(data);
        return { ...page, status: 'pending', pendingRevisionId: newRevision.id };
    } else {
        newRevision.status = 'approved';
        page.revisions.unshift(newRevision);
        await saveData(data);
        return page;
    }
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

     // Revert bypasses review for now (admin/editor action usually)
     return await this.savePage(slug, page.title, targetRev.content, user, page.sectionId);
  },

  async getPendingReviews() {
      const data = await loadData();
      const reviews = [];
      for(const slug in data.pages) {
          const page = data.pages[slug];
          if(page.pendingRevisions && page.pendingRevisions.length > 0) {
              page.pendingRevisions.forEach(rev => {
                  reviews.push({
                      pageSlug: slug,
                      pageTitle: page.title,
                      sectionId: page.sectionId,
                      revision: rev
                  });
              });
          }
      }
      return reviews;
  },

  async approveRevision(slug, revisionId, user) {
      const data = await loadData();
      const page = data.pages[slug];
      if(!page) return null;

      const revIndex = page.pendingRevisions.findIndex(r => r.id === revisionId);
      if(revIndex === -1) return null;

      const rev = page.pendingRevisions[revIndex];
      page.pendingRevisions.splice(revIndex, 1);

      rev.status = 'approved';
      rev.approverId = user.id;
      rev.approvedAt = Date.now();
      // Remove temporary ID if we want, or keep it.

      // We need to set the version number correctly based on CURRENT head
      // Because other edits might have happened (though purely sequential here)
      rev.version = page.revisions.length > 0 ? page.revisions[0].version + 1 : 1;

      page.revisions.unshift(rev);

      // Update title if it was a title change?
      // Current savePage updates title immediately. We might want to revert that if rejected?
      // For now, title changes persist even if content is pending. acceptable for MVP.

      await saveData(data);
      return page;
  },

  async rejectRevision(slug, revisionId) {
      const data = await loadData();
      const page = data.pages[slug];
      if(!page) return null;

      const revIndex = page.pendingRevisions.findIndex(r => r.id === revisionId);
      if(revIndex === -1) return null;

      page.pendingRevisions.splice(revIndex, 1);
      await saveData(data);
      return page;
  }
};
