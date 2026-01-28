
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'wiki.json');

const SEED_DATA = {
  users: [
    { id: 'u1', name: 'Alice (Admin)', isAdmin: true },
    { id: 'u2', name: 'Bob (Editor)', isAdmin: false },
    { id: 'u3', name: 'Charlie (Viewer)', isAdmin: false },
  ],
  sections: {
    general: {
      id: 'general',
      title: 'General',
      readUsers: ['u1', 'u2', 'u3'],
      writeUsers: ['u1', 'u2'],
      reviewRequired: false,
      approverUsers: ['u1']
    },
    restricted: {
      id: 'restricted',
      title: 'Restricted Area',
      readUsers: ['u1', 'u2'],
      writeUsers: ['u1', 'u2'],
      reviewRequired: true,
      approverUsers: ['u1']
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
          content: "# Welcome to the Wiki\n\nBuild shared knowledge with clarity and confidence. This wiki includes fast search, clean version history, and smart permissions.\n\n## Get started\n\n*   Read the latest updates\n*   Edit a page to propose changes\n*   Review and approve updates when needed\n\nTip: Try editing this page to create your first revision!",
          authorId: 'u1',
          timestamp: Date.now()
        }
      ]
    }
  }
};

function normalizeData(data) {
  let changed = false;

  if (data.groups || Object.values(data.sections || {}).some(s => s.readGroups || s.writeGroups || s.approverGroups)) {
    const users = (data.users || []).map(u => ({
      id: u.id,
      name: u.name,
      isAdmin: Array.isArray(u.groups) ? u.groups.includes('admin') : Boolean(u.isAdmin)
    }));

    const userIdsByGroup = new Map();
    if (Array.isArray(data.users)) {
      data.users.forEach(u => {
        (u.groups || []).forEach(g => {
          if (!userIdsByGroup.has(g)) userIdsByGroup.set(g, []);
          userIdsByGroup.get(g).push(u.id);
        });
      });
    }

    const sections = {};
    Object.values(data.sections || {}).forEach(section => {
      const readUsers = (section.readGroups || []).flatMap(g => userIdsByGroup.get(g) || []);
      const writeUsers = (section.writeGroups || []).flatMap(g => userIdsByGroup.get(g) || []);
      const approverUsers = (section.approverGroups || []).flatMap(g => userIdsByGroup.get(g) || []);

      sections[section.id] = {
        id: section.id,
        title: section.title,
        readUsers,
        writeUsers,
        reviewRequired: Boolean(section.reviewRequired),
        approverUsers
      };
    });

    data = {
      ...data,
      users,
      sections,
      groups: undefined
    };
    changed = true;
  }

  if (!Array.isArray(data.users)) {
    data.users = [];
    changed = true;
  }

  if (!data.sections) {
    data.sections = {};
    changed = true;
  }

  Object.values(data.sections).forEach(section => {
    if (!Array.isArray(section.readUsers)) section.readUsers = [];
    if (!Array.isArray(section.writeUsers)) section.writeUsers = [];
    if (!Array.isArray(section.approverUsers)) section.approverUsers = [];
    if (section.reviewRequired === undefined) section.reviewRequired = false;
  });

  return { data, changed };
}

async function loadData() {
  try {
    await fs.access(DB_PATH);
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const { data, changed } = normalizeData(parsed);
    if (changed) await saveData(data);
    return data;
  } catch {
    // If file doesn't exist, create it with seed data
    await saveData(SEED_DATA);
    return SEED_DATA;
  }
}

async function saveData(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

async function checkAdmin(userId, data) {
  if (!userId) throw new Error('Unauthorized');
  const dbUser = data.users.find(u => u.id === userId);
  if (!dbUser) throw new Error('User not found');
  if (dbUser.isAdmin) return true;
  throw new Error('Permission denied: Admin access required');
}

function getUserById(data, userId) {
  return data.users.find(u => u.id === userId);
}

export const dbController = {
  async getUsers() {
    const data = await loadData();
    return data.users;
  },

  async getSections() {
    const data = await loadData();
    return Object.values(data.sections);
  },

  async createSection(id, sectionData, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    if (data.sections[id]) throw new Error('Section already exists');
    data.sections[id] = { ...sectionData, id };
    await saveData(data);
    return data.sections[id];
  },

  async updateSection(id, sectionData, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    if (!data.sections[id]) throw new Error('Section not found');
    data.sections[id] = { ...sectionData, id };
    await saveData(data);
    return data.sections[id];
  },

  async deleteSection(id, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    if (!data.sections[id]) throw new Error('Section not found');
    delete data.sections[id];
    await saveData(data);
    return { success: true };
  },

  async getPages(userId) {
    const data = await loadData();
    if (!userId) return [];

    return Object.values(data.pages)
      .filter(p => {
        const section = data.sections[p.sectionId || 'general'];
        return section && section.readUsers.includes(userId);
      })
      .map(p => {
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

  async getPage(slug, userId) {
    const data = await loadData();
    const page = data.pages[slug];
    if (!page) return null;
    const section = data.sections[page.sectionId || 'general'];
    if (!section || !userId || !section.readUsers.includes(userId)) {
      throw new Error('Permission denied');
    }

    return {
      ...page,
      currentRevision: page.revisions[0]
    };
  },

  async savePage(slug, title, content, userId, sectionId) {
    const data = await loadData();
    let page = data.pages[slug];

    const targetSectionId = sectionId || (page ? page.sectionId : 'general');
    const section = data.sections[targetSectionId];
    if (!section) throw new Error('Invalid section');

    const dbUser = getUserById(data, userId);
    if (!dbUser) throw new Error('User not found');

    const canWrite = section.writeUsers.includes(userId);
    if (!canWrite) throw new Error('Permission denied');

    const reviewRequired = section.reviewRequired || page?.reviewRequired;

    if (reviewRequired) {
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
        if (!page.pendingRevisions) page.pendingRevisions = [];
      }

      page.pendingRevisions.push({
        content,
        title,
        authorId: userId,
        timestamp: Date.now(),
        sectionId: targetSectionId
      });

      await saveData(data);
      return { ...page, status: 'pending' };
    }

    const newRevision = {
      version: (page && page.revisions.length > 0) ? page.revisions[0].version + 1 : 1,
      content,
      authorId: userId,
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

  async approveRevision(slug, index, userId) {
    const data = await loadData();
    const page = data.pages[slug];
    if (!page || !page.pendingRevisions || !page.pendingRevisions[index]) {
      throw new Error('Revision not found');
    }

    const pendingRev = page.pendingRevisions[index];
    const section = data.sections[pendingRev.sectionId || page.sectionId];

    if (!section || !section.approverUsers.includes(userId)) {
      throw new Error('Permission denied');
    }

    if (userId === pendingRev.authorId) {
      throw new Error('Cannot approve your own changes');
    }

    const newRevision = {
      version: (page.revisions.length > 0) ? page.revisions[0].version + 1 : 1,
      content: pendingRev.content,
      authorId: pendingRev.authorId,
      timestamp: pendingRev.timestamp,
      approvedBy: userId,
      approvedAt: Date.now()
    };

    page.revisions.unshift(newRevision);
    page.title = pendingRev.title;
    if (pendingRev.sectionId) page.sectionId = pendingRev.sectionId;

    page.pendingRevisions.splice(index, 1);

    await saveData(data);
    return page;
  },

  async rejectRevision(slug, index, userId) {
    const data = await loadData();
    const page = data.pages[slug];
    if (!page || !page.pendingRevisions || !page.pendingRevisions[index]) {
      throw new Error('Revision not found');
    }

    const pendingRev = page.pendingRevisions[index];
    const section = data.sections[pendingRev.sectionId || page.sectionId];

    if (!section || !section.approverUsers.includes(userId)) {
      throw new Error('Permission denied');
    }

    page.pendingRevisions.splice(index, 1);

    await saveData(data);
    return page;
  },

  async getHistory(slug) {
     const data = await loadData();
     const page = data.pages[slug];
     return page ? page.revisions : [];
  },

  async revert(slug, version, userId) {
    const data = await loadData();
    const page = data.pages[slug];
    if (!page) return null;

    const targetRev = page.revisions.find(r => r.version === parseInt(version));
    if (!targetRev) return null;

    return await this.savePage(slug, page.title, targetRev.content, userId, page.sectionId);
  }
};
