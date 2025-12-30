
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
      writeGroups: ['editor', 'admin'],
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

async function checkAdmin(user, data) {
    if (!user) throw new Error("Unauthorized");
    const dbUser = data.users.find(u => u.id === user.id);
    if (!dbUser) throw new Error("User not found");

    // Check if user is in admin group
    if (dbUser.groups.includes('admin')) return true;

    // Or check explicit manage permission if we want to be more granular
    // But for now, hardcoding admin check for simplicity as requested
    throw new Error("Permission denied: Admin access required");
}

export const dbController = {
  async getUsers() {
    const data = await loadData();
    return data.users;
  },

  async createUser(user, requestor) {
      const data = await loadData();
      await checkAdmin(requestor, data);

      if (data.users.find(u => u.id === user.id)) throw new Error("User ID already exists");
      data.users.push(user);
      await saveData(data);
      return user;
  },

  async updateUser(id, userData, requestor) {
      const data = await loadData();
      await checkAdmin(requestor, data);

      const index = data.users.findIndex(u => u.id === id);
      if (index === -1) throw new Error("User not found");

      // Merge updates
      data.users[index] = { ...data.users[index], ...userData, id }; // Keep ID immutable ideally, but let's allow overwrite if passed matches
      await saveData(data);
      return data.users[index];
  },

  async deleteUser(id, requestor) {
      const data = await loadData();
      await checkAdmin(requestor, data);

      const index = data.users.findIndex(u => u.id === id);
      if (index === -1) throw new Error("User not found");

      data.users.splice(index, 1);
      await saveData(data);
      return { success: true };
  },

  async getGroups() {
    const data = await loadData();
    return data.groups;
  },

  async createGroup(id, groupData, requestor) {
      const data = await loadData();
      await checkAdmin(requestor, data);

      if (data.groups[id]) throw new Error("Group already exists");
      data.groups[id] = groupData;
      await saveData(data);
      return { id, ...groupData };
  },

  async updateGroup(id, groupData, requestor) {
      const data = await loadData();
      await checkAdmin(requestor, data);

      if (!data.groups[id]) throw new Error("Group not found");
      data.groups[id] = groupData;
      await saveData(data);
      return { id, ...groupData };
  },

  async deleteGroup(id, requestor) {
      const data = await loadData();
      await checkAdmin(requestor, data);

      if (!data.groups[id]) throw new Error("Group not found");
      delete data.groups[id];
      await saveData(data);
      return { success: true };
  },

  async getSections() {
    const data = await loadData();
    return data.sections;
  },

  async createSection(id, sectionData, requestor) {
      const data = await loadData();
      await checkAdmin(requestor, data);

      if (data.sections[id]) throw new Error("Section already exists");
      data.sections[id] = { ...sectionData, id };
      await saveData(data);
      return data.sections[id];
  },

  async updateSection(id, sectionData, requestor) {
      const data = await loadData();
      await checkAdmin(requestor, data);

      if (!data.sections[id]) throw new Error("Section not found");
      data.sections[id] = { ...sectionData, id };
      await saveData(data);
      return data.sections[id];
  },

  async deleteSection(id, requestor) {
      const data = await loadData();
      await checkAdmin(requestor, data);

      if (!data.sections[id]) throw new Error("Section not found");
      delete data.sections[id];
      await saveData(data);
      return { success: true };
  },

  async getPages(user) {
    const data = await loadData();
    // If no user provided, return nothing or public only?
    // Assuming viewer group is minimum. If no user, maybe we shouldn't return anything or just public?
    // Let's assume user is required for now as per frontend flow.
    // If user is null/undefined, treat as anonymous (no groups).

    const userGroups = user ? (data.users.find(u => u.id === user.id)?.groups || []) : [];

    return Object.values(data.pages).filter(p => {
       const section = data.sections[p.sectionId || 'general'];
       return section && section.readGroups.some(g => userGroups.includes(g));
    }).map(p => {
       const head = p.revisions[0] || {};
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

    const userGroups = user ? (data.users.find(u => u.id === user.id)?.groups || []) : [];
    const section = data.sections[page.sectionId || 'general'];

    if (!section || !section.readGroups.some(g => userGroups.includes(g))) {
        // Permission denied (or not found to hide existence if strictly secure, but 403 is better for now)
        throw new Error("Permission denied");
    }

    return {
      ...page,
      currentRevision: page.revisions[0]
    };
  },

  async savePage(slug, title, content, user, sectionId) {
    const data = await loadData();
    let page = data.pages[slug];

    // Determine section
    const targetSectionId = sectionId || (page ? page.sectionId : 'general');
    const section = data.sections[targetSectionId];
    if (!section) throw new Error("Invalid section");

    // Check write permissions
    // Find full user object to get groups (trusting input user for now, but should ideally re-verify)
    const dbUser = data.users.find(u => u.id === user.id);
    if (!dbUser) throw new Error("User not found");

    const canWrite = section.writeGroups.some(g => dbUser.groups.includes(g));
    if (!canWrite) throw new Error("Permission denied");

    // Check review requirements
    const reviewRequired = section.reviewRequired || page?.reviewRequired;
    // const isApprover = section.approverGroups.some(g => dbUser.groups.includes(g));

    // Even if user is approver, if review is required, we queue it.
    if (reviewRequired) {
        if (!page) {
             // Create page shell if it doesn't exist
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
             // Ensure pendingRevisions array exists
             if (!page.pendingRevisions) page.pendingRevisions = [];
             // Update metadata if needed (though title change might need review too)
             // For now we store the proposed changes in pendingRevision
        }

        page.pendingRevisions.push({
            content,
            title,
            authorId: user.id,
            timestamp: Date.now(),
            sectionId: targetSectionId
        });

        await saveData(data);
        return { ...page, status: 'pending' };
    }

    // Normal Save (Publish immediately)
    const newRevision = {
      version: (page && page.revisions.length > 0) ? page.revisions[0].version + 1 : 1,
      content,
      authorId: user.id,
      timestamp: Date.now()
    };

    if (!page) {
      page = {
        id: slug,
        slug,
        title,
        sectionId: targetSectionId,
        revisions: []
      };
      data.pages[slug] = page;
    } else {
        page.title = title;
        page.sectionId = targetSectionId;
    }

    page.revisions.unshift(newRevision);

    await saveData(data);
    return { ...page, status: 'published' };
  },

  async approveRevision(slug, index, user) {
     const data = await loadData();
     const page = data.pages[slug];
     if (!page || !page.pendingRevisions || !page.pendingRevisions[index]) {
         throw new Error("Revision not found");
     }

     const pendingRev = page.pendingRevisions[index];
     const section = data.sections[pendingRev.sectionId || page.sectionId];

     const dbUser = data.users.find(u => u.id === user.id);
     const isApprover = section.approverGroups.some(g => dbUser.groups.includes(g));

     if (!isApprover) throw new Error("Permission denied");

     // Self-approval check
     if (user.id === pendingRev.authorId) {
         throw new Error("Cannot approve your own changes");
     }

     // Apply the revision
     const newRevision = {
         version: (page.revisions.length > 0) ? page.revisions[0].version + 1 : 1,
         content: pendingRev.content,
         authorId: pendingRev.authorId,
         timestamp: pendingRev.timestamp,
         approvedBy: user.id,
         approvedAt: Date.now()
     };

     page.revisions.unshift(newRevision);
     page.title = pendingRev.title; // Update title if it changed
     if (pendingRev.sectionId) page.sectionId = pendingRev.sectionId;

     // Remove from pending
     page.pendingRevisions.splice(index, 1);

     await saveData(data);
     return page;
  },

  async rejectRevision(slug, index, user) {
     const data = await loadData();
     const page = data.pages[slug];
     if (!page || !page.pendingRevisions || !page.pendingRevisions[index]) {
         throw new Error("Revision not found");
     }

     const pendingRev = page.pendingRevisions[index];
     const section = data.sections[pendingRev.sectionId || page.sectionId];

     const dbUser = data.users.find(u => u.id === user.id);
     const isApprover = section.approverGroups.some(g => dbUser.groups.includes(g));

     if (!isApprover) throw new Error("Permission denied");

     // Just remove it
     page.pendingRevisions.splice(index, 1);

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

     // Revert counts as a new save, so we go through savePage to handle checks
     return await this.savePage(slug, page.title, targetRev.content, user, page.sectionId);
  }
};
