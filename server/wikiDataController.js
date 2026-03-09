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
    'General': {
      title: 'General',
      readUsers: ['u1', 'u2', 'u3'],
      writeUsers: ['u1', 'u2'],
      reviewRequired: false,
      approverUsers: ['u1']
    },
    'Restricted Area': {
      title: 'Restricted Area',
      readUsers: ['u1', 'u2'],
      writeUsers: ['u1', 'u2'],
      reviewRequired: true,
      approverUsers: ['u1']
    }
  },
  pages: {
    'Home': {
      title: 'Home',
      sectionId: 'General',
      revisions: [
        {
          version: 1,
          content: "# About This Wiki\n\nThis wiki is a lightweight knowledge base for shared notes, team docs, and internal reference pages.\n\n## Features\n\n- Browse pages by section and filter them with search\n- Write in Markdown with a built-in preview\n- Upload images and files directly into pages\n- Review revision history and compare older changes\n- Revert to an earlier version when needed\n- Control access with section-based read and write permissions\n- Route updates through approval when a section requires review\n\n## How to use it\n\n1. Open a page from the sidebar or create a new one.\n2. Edit in Markdown, then switch to Preview before saving.\n3. Use History to inspect changes or restore an older revision.\n4. In sections that require review, approvers can accept or reject pending edits.",
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

      const title = section.title || section.id;
      if (!title) return;

      sections[title] = {
        title,
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

  if (!data.pages) {
    data.pages = {};
    changed = true;
  }

  const normalizedSections = {};
  const sectionIdToTitle = new Map();
  Object.entries(data.sections).forEach(([key, section]) => {
    if (!section) return;
    const title = section.title || section.id || key;
    if (!title) return;

    normalizedSections[title] = {
      ...section,
      title
    };
    delete normalizedSections[title].id;

    sectionIdToTitle.set(key, title);
    if (section?.id) sectionIdToTitle.set(section.id, title);
  });

  if (Object.keys(normalizedSections).length !== Object.keys(data.sections).length || Object.values(data.sections).some(s => s?.id)) {
    data.sections = normalizedSections;
    changed = true;
  }

  Object.values(data.sections).forEach(section => {
    if (!Array.isArray(section.readUsers)) section.readUsers = [];
    if (!Array.isArray(section.writeUsers)) section.writeUsers = [];
    if (!Array.isArray(section.approverUsers)) section.approverUsers = [];
    if (section.reviewRequired === undefined) section.reviewRequired = false;
  });

  const defaultSectionTitle = Object.keys(data.sections)[0] || '';

  if (data.pages && typeof data.pages === 'object') {
    const normalizedPages = {};
    Object.values(data.pages).forEach(page => {
      if (!page) return;
      const title = page.title || page.slug || page.id;
      if (!title) return;

      let normalizedSectionId = page.sectionId || page.sectionTitle || defaultSectionTitle;
      if (sectionIdToTitle.has(normalizedSectionId)) {
        normalizedSectionId = sectionIdToTitle.get(normalizedSectionId);
      } else if (data.sections && data.sections[normalizedSectionId]) {
        // ok
      } else if (data.sections) {
        const match = Object.values(data.sections).find(s => s.title === page.sectionId || s.title === page.sectionTitle);
        if (match) normalizedSectionId = match.title;
      }

      const cleanedPage = {
        ...page,
        title,
        sectionId: normalizedSectionId || defaultSectionTitle
      };
      delete cleanedPage.slug;
      delete cleanedPage.id;

      normalizedPages[title] = cleanedPage;
    });

    const originalCount = Object.keys(data.pages).length;
    const normalizedCount = Object.keys(normalizedPages).length;
    const pagesNeedUpdate = Object.values(data.pages).some(p => p?.slug || p?.id || p?.sectionTitle);
    if (originalCount !== normalizedCount || pagesNeedUpdate) {
      data.pages = normalizedPages;
      changed = true;
    }
  }

  if (data.pages && typeof data.pages === 'object') {
    Object.values(data.pages).forEach(page => {
      if (!page) return;
      if (!page.sectionId || !data.sections[page.sectionId]) {
        page.sectionId = defaultSectionTitle;
        changed = true;
      }

      if (Array.isArray(page.pendingRevisions)) {
        page.pendingRevisions.forEach(rev => {
          if (!rev.sectionId || !data.sections[rev.sectionId]) {
            rev.sectionId = page.sectionId || defaultSectionTitle;
            changed = true;
          }
        });
      }
    });
  }

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

function getDefaultSectionTitle(data) {
  return Object.keys(data.sections || {})[0] || '';
}

function hasWikiPageChanges(page, nextContent, nextSectionId) {
  if (!page) return true;

  const currentContent = page.revisions?.[0]?.content || '';
  const currentSectionId = page.sectionId;

  if (currentContent !== nextContent) return true;
  if (currentSectionId !== nextSectionId) return true;

  return false;
}

function hasPendingWikiPageChanges(page, nextContent, nextSectionId) {
  if (!Array.isArray(page?.pendingRevisions) || page.pendingRevisions.length === 0) {
    return false;
  }

  return page.pendingRevisions.some(revision => revision.content === nextContent && revision.sectionId === nextSectionId);
}

export const wikiDataController = {
  async getWikiUsers() {
    const data = await loadData();
    return data.users;
  },

  async getWikiSections() {
    const data = await loadData();
    return Object.values(data.sections);
  },

  async createWikiSection(title, sectionData, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedTitle = (title || sectionData?.title || '').trim();
    if (!normalizedTitle) throw new Error('Title is required');
    if (data.sections[normalizedTitle]) throw new Error('Section already exists');
    data.sections[normalizedTitle] = { ...sectionData, title: normalizedTitle };
    await saveData(data);
    return data.sections[normalizedTitle];
  },

  async updateWikiSection(title, sectionData, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedTitle = (title || '').trim();
    if (!normalizedTitle) throw new Error('Title is required');
    if (!data.sections[normalizedTitle]) throw new Error('Section not found');

    const nextTitle = (sectionData?.title || normalizedTitle).trim();
    if (!nextTitle) throw new Error('Title is required');

    if (nextTitle !== normalizedTitle && data.sections[nextTitle]) {
      throw new Error('Section already exists');
    }

    const updatedSection = { ...sectionData, title: nextTitle };

    if (nextTitle !== normalizedTitle) {
      delete data.sections[normalizedTitle];
      data.sections[nextTitle] = updatedSection;

      Object.values(data.pages).forEach(page => {
        if (page.sectionId === normalizedTitle) page.sectionId = nextTitle;
        if (Array.isArray(page.pendingRevisions)) {
          page.pendingRevisions.forEach(rev => {
            if (rev.sectionId === normalizedTitle) rev.sectionId = nextTitle;
          });
        }
      });
    } else {
      data.sections[normalizedTitle] = updatedSection;
    }
    await saveData(data);
    return data.sections[nextTitle];
  },

  async deleteWikiSection(title, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedTitle = (title || '').trim();
    if (!normalizedTitle) throw new Error('Title is required');
    if (!data.sections[normalizedTitle]) throw new Error('Section not found');
    delete data.sections[normalizedTitle];

    const defaultSectionTitle = getDefaultSectionTitle(data);
    Object.values(data.pages).forEach(page => {
      if (page.sectionId === normalizedTitle) page.sectionId = defaultSectionTitle;
      if (Array.isArray(page.pendingRevisions)) {
        page.pendingRevisions.forEach(rev => {
          if (rev.sectionId === normalizedTitle) rev.sectionId = defaultSectionTitle;
        });
      }
    });
    await saveData(data);
    return { success: true };
  },

  async getWikiPages(userId) {
    const data = await loadData();
    if (!userId) return [];

    const defaultSectionTitle = getDefaultSectionTitle(data);

    return Object.values(data.pages)
      .filter(page => {
        const section = data.sections[page.sectionId || defaultSectionTitle];
        return section && section.readUsers.includes(userId);
      })
      .map(page => {
        const head = page.revisions[0] || {};
        return {
          title: page.title,
          sectionId: page.sectionId,
          updatedAt: head.timestamp,
          authorId: head.authorId
        };
      });
  },

  async getWikiPage(title, userId) {
    const data = await loadData();
    const page = data.pages[title];
    if (!page) return null;
    const defaultSectionTitle = getDefaultSectionTitle(data);
    const section = data.sections[page.sectionId || defaultSectionTitle];
    if (!section || !userId || !section.readUsers.includes(userId)) {
      throw new Error('Permission denied');
    }

    return {
      ...page,
      currentRevision: page.revisions[0]
    };
  },

  async saveWikiPage(title, content, userId, sectionId) {
    const data = await loadData();
    const normalizedTitle = title?.trim();
    if (!normalizedTitle) throw new Error('Title is required');
    let page = data.pages[normalizedTitle];

    const defaultSectionTitle = getDefaultSectionTitle(data);
    const targetSectionId = sectionId || (page ? page.sectionId : defaultSectionTitle);
    const section = data.sections[targetSectionId];
    if (!section) throw new Error('Invalid section');

    const dbUser = getUserById(data, userId);
    if (!dbUser) throw new Error('User not found');

    const canWrite = section.writeUsers.includes(userId);
    if (!canWrite) throw new Error('Permission denied');

    if (!hasWikiPageChanges(page, content, targetSectionId)) {
      throw new Error('No changes to save');
    }

    const reviewRequired = section.reviewRequired || page?.reviewRequired;

    if (reviewRequired) {
      if (hasPendingWikiPageChanges(page, content, targetSectionId)) {
        throw new Error('No changes to save');
      }

      if (!page) {
        page = {
          title: normalizedTitle,
          sectionId: targetSectionId,
          revisions: [],
          pendingRevisions: []
        };
        data.pages[normalizedTitle] = page;
      } else if (!page.pendingRevisions) {
        page.pendingRevisions = [];
      }

      page.pendingRevisions.push({
        content,
        title: normalizedTitle,
        authorId: userId,
        timestamp: Date.now(),
        sectionId: targetSectionId
      });

      await saveData(data);
      return { ...page, status: 'pending' };
    }

    const newRevision = {
      version: page && page.revisions.length > 0 ? page.revisions[0].version + 1 : 1,
      content,
      authorId: userId,
      timestamp: Date.now()
    };

    if (!page) {
      page = {
        title: normalizedTitle,
        sectionId: targetSectionId,
        revisions: []
      };
      data.pages[normalizedTitle] = page;
    } else {
      page.title = normalizedTitle;
      page.sectionId = targetSectionId;
    }

    page.revisions.unshift(newRevision);

    await saveData(data);
    return { ...page, status: 'published' };
  },

  async approveWikiRevision(title, index, userId) {
    const data = await loadData();
    const page = data.pages[title];
    if (!page || !page.pendingRevisions || !page.pendingRevisions[index]) {
      throw new Error('Revision not found');
    }

    const pendingRevision = page.pendingRevisions[index];
    const defaultSectionTitle = getDefaultSectionTitle(data);
    const section = data.sections[pendingRevision.sectionId || page.sectionId || defaultSectionTitle];

    if (!section || !section.approverUsers.includes(userId)) {
      throw new Error('Permission denied');
    }

    if (userId === pendingRevision.authorId) {
      throw new Error('Cannot approve your own changes');
    }

    const newRevision = {
      version: page.revisions.length > 0 ? page.revisions[0].version + 1 : 1,
      content: pendingRevision.content,
      authorId: pendingRevision.authorId,
      timestamp: pendingRevision.timestamp,
      approvedBy: userId,
      approvedAt: Date.now()
    };

    page.revisions.unshift(newRevision);
    page.title = pendingRevision.title;
    if (pendingRevision.sectionId) page.sectionId = pendingRevision.sectionId;

    page.pendingRevisions.splice(index, 1);

    await saveData(data);
    return page;
  },

  async rejectWikiRevision(title, index, userId) {
    const data = await loadData();
    const page = data.pages[title];
    if (!page || !page.pendingRevisions || !page.pendingRevisions[index]) {
      throw new Error('Revision not found');
    }

    const pendingRevision = page.pendingRevisions[index];
    const defaultSectionTitle = getDefaultSectionTitle(data);
    const section = data.sections[pendingRevision.sectionId || page.sectionId || defaultSectionTitle];

    if (!section || !section.approverUsers.includes(userId)) {
      throw new Error('Permission denied');
    }

    page.pendingRevisions.splice(index, 1);

    await saveData(data);
    return page;
  },

  async getWikiPageHistory(title) {
    const data = await loadData();
    const page = data.pages[title];
    return page ? page.revisions : [];
  },

  async revertWikiPage(title, version, userId) {
    const data = await loadData();
    const page = data.pages[title];
    if (!page) return null;

    const targetRevision = page.revisions.find(revision => revision.version === parseInt(version));
    if (!targetRevision) return null;

    return this.saveWikiPage(page.title, targetRevision.content, userId, page.sectionId);
  }
};