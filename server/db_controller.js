
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'wiki.json');

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
    general: {
      id: 'general',
      title: 'General',
      readGroups: ['viewer', 'editor', 'admin'],
      writeGroups: ['editor', 'admin'],
      reviewRequired: false,
      approverGroups: ['admin']
    },
    restricted: {
      id: 'restricted',
      title: 'Restricted Area',
      readGroups: ['editor', 'admin'],
      writeGroups: ['admin'],
      reviewRequired: true,
      approverGroups: ['admin']
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

  async getSections() {
    const data = await loadData();
    return data.sections;
  },

  async getPages() {
    const data = await loadData();
    return Object.values(data.pages).map(p => {
       const head = p.revisions[0];
       // If no revisions (e.g. only pending), handle gracefully
       if (!head) return {
         slug: p.slug,
         title: p.title,
         sectionId: p.sectionId,
         updatedAt: 0,
         authorId: null
       };

       return {
         slug: p.slug,
         title: p.title,
         sectionId: p.sectionId,
         updatedAt: head.timestamp,
         authorId: head.authorId
       };
    });
  },

  async getPage(slug, user) {
    const data = await loadData();
    const page = data.pages[slug];
    if (!page) return null;

    const sectionId = page.sectionId || 'general';
    const section = data.sections[sectionId];

    // Check read permission if user is provided (if not provided, we might deny or allow public read)
    // The requirement implies permissions are enforced.
    // If no user provided (e.g. initial load without auth), we might assume 'viewer'?
    // But our API seems to require a user context for edits.
    // For Read, if we want to enforce it, we must have user.
    // However, existing API didn't enforce.
    // We will check if user is passed. If not, and section requires specific groups, we might deny.
    // But 'viewer' group is usually default.
    // Let's assume if no user, they are not in any group.

    const userGroups = user ? (data.users.find(u => u.id === user.id)?.groups || []) : [];
    const canRead = section && section.readGroups.some(g => userGroups.includes(g));

    if (!canRead) {
        // Return null or throw?
        // If we throw, server returns 500 or 403.
        // Let's return null to simulate not found or just throw.
        throw new Error("Permission denied");
    }

    return {
      ...page,
      currentRevision: page.revisions[0] || null,
    };
  },

  async savePage(slug, title, content, user, sectionId) {
    const data = await loadData();
    let page = data.pages[slug];

    // Determine Section
    const targetSectionId = sectionId || (page ? page.sectionId : 'general');
    const targetSection = data.sections[targetSectionId];
    if (!targetSection) throw new Error("Invalid section");

    const dbUser = data.users.find(u => u.id === user.id);
    if (!dbUser) throw new Error("User not found");

    // If page exists and section is changing, check write permissions for OLD section too.
    if (page && page.sectionId && page.sectionId !== targetSectionId) {
        const oldSection = data.sections[page.sectionId];
        // If old section logic is missing/deleted, maybe allow? But better safe:
        if (oldSection) {
            const canWriteOld = oldSection.writeGroups.some(g => dbUser.groups.includes(g));
            if (!canWriteOld) throw new Error("Permission denied: You cannot move pages from the current section.");
        }
    }

    // Check Write Permission for TARGET section
    const canWriteTarget = targetSection.writeGroups.some(g => dbUser.groups.includes(g));
    if (!canWriteTarget) throw new Error("Permission denied: You do not have write access to the target section.");

    // Check Review Requirement
    const reviewRequired = targetSection.reviewRequired || (page && page.reviewRequired);
    const isApprover = targetSection.approverGroups.some(g => dbUser.groups.includes(g));

    if (!page) {
      page = {
        id: slug,
        slug,
        title,
        sectionId: targetSectionId,
        revisions: [],
        pendingRevisions: []
      };
      data.pages[slug] = page;
    } else {
        // Update metadata
        page.title = title;
        page.sectionId = targetSectionId;
    }

    if (reviewRequired && !isApprover) {
        // Add to pending revisions
        if (!page.pendingRevisions) page.pendingRevisions = [];

        page.pendingRevisions.push({
            content,
            title, // Title might be changed too
            sectionId: targetSectionId,
            authorId: user.id,
            timestamp: Date.now()
        });
        await saveData(data);
        return { ...page, status: 'pending' };
    }

    // Direct Publish
    const newRevision = {
      version: (page.revisions.length > 0) ? page.revisions[0].version + 1 : 1,
      content,
      authorId: user.id,
      timestamp: Date.now()
    };

    page.revisions.unshift(newRevision);

    await saveData(data);
    return { ...page, status: 'published' };
  },

  async approveRevision(slug, revisionIndex, user) {
      const data = await loadData();
      const page = data.pages[slug];
      if (!page || !page.pendingRevisions || page.pendingRevisions.length <= revisionIndex) {
          throw new Error("Revision not found");
      }

      // Check permissions
      const section = data.sections[page.sectionId];
      const dbUser = data.users.find(u => u.id === user.id);
      if (!dbUser || !section.approverGroups.some(g => dbUser.groups.includes(g))) {
          throw new Error("Permission denied: You are not an approver.");
      }

      const pendingRev = page.pendingRevisions[revisionIndex];

      // Apply the revision
      // Update page title/section if they were part of pending change?
      // Our pending object stores title/sectionId.
      if (pendingRev.title) page.title = pendingRev.title;
      if (pendingRev.sectionId) page.sectionId = pendingRev.sectionId;

      const newRevision = {
          version: (page.revisions.length > 0) ? page.revisions[0].version + 1 : 1,
          content: pendingRev.content,
          authorId: pendingRev.authorId,
          timestamp: Date.now(), // or keep original timestamp? usually publish time
          approvedBy: user.id
      };

      page.revisions.unshift(newRevision);

      // Remove from pending
      page.pendingRevisions.splice(revisionIndex, 1);

      await saveData(data);
      return page;
  },

  async rejectRevision(slug, revisionIndex, user) {
      const data = await loadData();
      const page = data.pages[slug];
      if (!page || !page.pendingRevisions || page.pendingRevisions.length <= revisionIndex) {
          throw new Error("Revision not found");
      }

      const section = data.sections[page.sectionId];
      const dbUser = data.users.find(u => u.id === user.id);
      if (!dbUser || !section.approverGroups.some(g => dbUser.groups.includes(g))) {
          throw new Error("Permission denied");
      }

      // Just remove it
      page.pendingRevisions.splice(revisionIndex, 1);

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

     // Revert is a save action, so we reuse savePage logic to ensure checks
     return await this.savePage(slug, page.title, targetRev.content, user, page.sectionId);
  }
};
