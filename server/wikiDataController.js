import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'wiki.json');
const ADMIN_GROUPS = new Set(['admin', 'wiki_admin']);
const ADMIN_PERMISSION_GROUP = 'wiki_admin';
const PAGE_REVIEW_MODES = new Set(['inherit', 'required', 'exempt']);

const DIRECTORY_USERS = [
  { id: 'u1', name: 'Alice (Admin)' },
  { id: 'u2', name: 'Bob (Editor)' },
  { id: 'u3', name: 'Charlie (Viewer)' }
];

const SEED_DATA = {
  groups: {
    admin: {
      name: 'admin',
      memberIds: ['u1']
    },
    wiki_editors: {
      name: 'wiki_editors',
      memberIds: ['u1', 'u2']
    }
  },
  sections: {
    General: {
      title: 'General',
      readGroups: [],
      writeGroups: ['wiki_editors'],
      reviewRequired: false,
      approverGroups: []
    },
    'Restricted Area': {
      title: 'Restricted Area',
      readGroups: ['wiki_editors'],
      writeGroups: ['wiki_editors'],
      reviewRequired: true,
      approverGroups: []
    }
  },
  pages: {
    Home: {
      title: 'Home',
      sectionId: 'General',
      reviewMode: 'required',
      revisions: [
        {
          version: 1,
          content: "# About This Wiki\n\nThis wiki is a lightweight knowledge base for shared notes, team docs, and internal reference pages.\n\n## Features\n\n- Browse pages by section and filter them with search\n- Write in Markdown with a built-in preview\n- Upload images and files directly into pages\n- Review revision history and compare older changes\n- Revert to an earlier version when needed\n- Control access with section-based read and write permissions\n- Route updates through approval when a section requires review\n\n## How to use it\n\n1. Open a page from the sidebar or create a new one.\n2. Edit in Markdown, then switch to Preview before saving.\n3. Use History to inspect changes or restore an older revision.\n4. In sections that require review, approvers can accept or reject pending edits.",
          authorId: 'u1',
          timestamp: Date.now()
        }
      ]
    },
    Secret: {
      title: 'Secret',
      sectionId: 'Restricted Area',
      revisions: [
        {
          version: 1,
          content: 'Shhh',
          authorId: 'u1',
          timestamp: Date.now()
        }
      ]
    },
    'Top Secret': {
      title: 'Top Secret',
      sectionId: 'Restricted Area',
      revisions: [],
      pendingRevisions: [
        {
          content: 'This is top secret.',
          title: 'Top Secret',
          authorId: 'u2',
          timestamp: Date.now(),
          sectionId: 'Restricted Area'
        }
      ]
    }
  }
};

function dedupe(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function slugify(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'group';
}

function normalizeUsers(users) {
  return (Array.isArray(users) ? users : [])
    .map(user => ({
      id: user?.id,
      name: user?.name || user?.id || 'Unknown User'
    }))
    .filter(user => user.id);
}

function normalizeGroupName(name) {
  return (name || '').trim();
}

function normalizePageReviewMode(reviewMode, fallback = 'inherit') {
  return PAGE_REVIEW_MODES.has(reviewMode) ? reviewMode : fallback;
}

function normalizePermissionGroups(groupNames) {
  return dedupe((groupNames || []).map(groupName => {
    const normalizedName = normalizeGroupName(groupName);
    return ADMIN_GROUPS.has(normalizedName) ? '' : normalizedName;
  })).filter(groupName => groupName && groupName !== 'wiki_all');
}

function ensureGroup(groups, name, memberIds = []) {
  const normalizedName = normalizeGroupName(name);
  if (!normalizedName) return;

  if (!groups[normalizedName]) {
    groups[normalizedName] = { name: normalizedName, memberIds: [] };
  }

  groups[normalizedName].memberIds = dedupe([
    ...groups[normalizedName].memberIds,
    ...memberIds
  ]);
}

function normalizeGroups(rawGroups, validUserIds) {
  const groups = {};
  const sourceEntries = Array.isArray(rawGroups)
    ? rawGroups.map(group => [group?.name, group])
    : Object.entries(rawGroups || {});

  sourceEntries.forEach(([key, group]) => {
    const name = normalizeGroupName(group?.name || key);
    if (!name || name === 'wiki_all') return;

    const memberIds = dedupe(group?.memberIds || group?.users || []).filter(userId => validUserIds.has(userId));
    groups[name] = { name, memberIds };
  });

  return groups;
}

function buildLegacyPermissionGroupName(title, suffix) {
  return `wiki_${slugify(title)}_${suffix}`;
}

function normalizeSections(rawSections, groups, validUserIds) {
  const sections = {};
  const sectionIdToTitle = new Map();

  Object.entries(rawSections || {}).forEach(([key, section]) => {
    if (!section) return;

    const title = (section.title || section.id || key || '').trim();
    if (!title) return;

    let readGroups = Array.isArray(section.readGroups) ? normalizePermissionGroups(section.readGroups) : null;
    let writeGroups = Array.isArray(section.writeGroups) ? normalizePermissionGroups(section.writeGroups) : null;
    let approverGroups = Array.isArray(section.approverGroups)
      ? normalizePermissionGroups(section.approverGroups)
      : null;

    if (!readGroups) {
      readGroups = [];
      const groupName = buildLegacyPermissionGroupName(title, 'read');
      const memberIds = dedupe(section.readUsers || []).filter(userId => validUserIds.has(userId));
      if (memberIds.length > 0) {
        ensureGroup(groups, groupName, memberIds);
        readGroups.push(groupName);
      }
      readGroups = normalizePermissionGroups(readGroups);
    }

    if (!writeGroups) {
      writeGroups = [];
      const groupName = buildLegacyPermissionGroupName(title, 'write');
      const memberIds = dedupe(section.writeUsers || []).filter(userId => validUserIds.has(userId));
      if (memberIds.length > 0) {
        ensureGroup(groups, groupName, memberIds);
        writeGroups.push(groupName);
      }
      writeGroups = normalizePermissionGroups(writeGroups);
    }

    if (!approverGroups) {
      approverGroups = [];
      const groupName = buildLegacyPermissionGroupName(title, 'approver');
      const memberIds = dedupe(section.approverUsers || []).filter(userId => validUserIds.has(userId));
      if (memberIds.length > 0) {
        ensureGroup(groups, groupName, memberIds);
        approverGroups.push(groupName);
      }
      approverGroups = normalizePermissionGroups(approverGroups);
    }

    [...readGroups, ...writeGroups, ...approverGroups].forEach(groupName => ensureGroup(groups, groupName));

    sections[title] = {
      title,
      readGroups,
      writeGroups,
      approverGroups,
      reviewRequired: Boolean(section.reviewRequired)
    };

    sectionIdToTitle.set(key, title);
    if (section.id) sectionIdToTitle.set(section.id, title);
  });

  return { sections, sectionIdToTitle };
}

function normalizePages(rawPages, sectionIdToTitle, sectionTitles) {
  const defaultSectionTitle = sectionTitles[0] || '';
  const pages = {};

  Object.values(rawPages || {}).forEach(page => {
    if (!page) return;

    const title = page.title || page.slug || page.id;
    if (!title) return;

    let sectionId = page.sectionId || page.sectionTitle || defaultSectionTitle;
    if (sectionIdToTitle.has(sectionId)) {
      sectionId = sectionIdToTitle.get(sectionId);
    }

    if (!sectionTitles.includes(sectionId)) {
      sectionId = defaultSectionTitle;
    }

    const normalizedPage = {
      ...page,
      title,
      sectionId: sectionId || defaultSectionTitle,
      reviewMode: normalizePageReviewMode(page.reviewMode, title === 'Home' ? 'required' : 'inherit')
    };

    delete normalizedPage.slug;
    delete normalizedPage.id;
    delete normalizedPage.sectionTitle;

    if (!Array.isArray(normalizedPage.revisions)) {
      normalizedPage.revisions = [];
    }

    if (Array.isArray(normalizedPage.pendingRevisions)) {
      normalizedPage.pendingRevisions = normalizedPage.pendingRevisions.map(revision => ({
        ...revision,
        sectionId: sectionTitles.includes(revision?.sectionId) ? revision.sectionId : (normalizedPage.sectionId || defaultSectionTitle)
      }));
    }

    pages[title] = normalizedPage;
  });

  return pages;
}

function normalizeData(rawData) {
  const users = normalizeUsers(DIRECTORY_USERS);
  const validUserIds = new Set(users.map(user => user.id));
  const groups = normalizeGroups(rawData?.groups, validUserIds);

  const { sections, sectionIdToTitle } = normalizeSections(rawData?.sections, groups, validUserIds);
  const sectionTitles = Object.keys(sections);
  const pages = normalizePages(rawData?.pages, sectionIdToTitle, sectionTitles);

  Object.values(groups).forEach(group => {
    group.memberIds = dedupe(group.memberIds).filter(userId => validUserIds.has(userId));
  });

  return {
    users,
    groups,
    sections,
    pages
  };
}

function serializeData(data) {
  const { users: _users, ...persistedData } = data || {};
  return persistedData;
}

async function loadData() {
  try {
    await fs.access(DB_PATH);
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const data = normalizeData(parsed);
    await saveData(data);
    return data;
  } catch {
    await saveData(SEED_DATA);
    return normalizeData(SEED_DATA);
  }
}

async function saveData(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(serializeData(data), null, 2));
}

function getUserById(data, userId) {
  return data.users.find(user => user.id === userId);
}

function getUserGroupNames(data, userId) {
  return Object.values(data.groups)
    .filter(group => group.memberIds.includes(userId))
    .map(group => group.name);
}

function isAdminUser(data, userId) {
  return getUserGroupNames(data, userId).some(groupName => ADMIN_GROUPS.has(groupName));
}

async function checkAdmin(userId, data) {
  if (!userId) throw new Error('Unauthorized');
  if (!getUserById(data, userId)) throw new Error('User not found');
  if (!isAdminUser(data, userId)) throw new Error('Permission denied: Admin access required');
}

function getDefaultSectionTitle(data) {
  return Object.keys(data.sections || {})[0] || '';
}

function isPageReviewRequired(page, section) {
  if (page?.reviewMode === 'required') return true;
  if (page?.reviewMode === 'exempt') return false;
  return Boolean(section?.reviewRequired);
}

function getPageApproverGroups(page, section) {
  if (!isPageReviewRequired(page, section)) {
    return [];
  }

  const approverGroups = section?.approverGroups || [];
  return approverGroups.length > 0 ? approverGroups : [ADMIN_PERMISSION_GROUP];
}

function hasWikiPageChanges(page, nextTitle, nextContent, nextSectionId) {
  if (!page) return true;

  const currentContent = page.revisions?.[0]?.content || '';
  const currentSectionId = page.sectionId;
  const currentTitle = page.title;

  return currentTitle !== nextTitle || currentContent !== nextContent || currentSectionId !== nextSectionId;
}

function hasPendingWikiPageChanges(page, nextTitle, nextContent, nextSectionId) {
  if (!Array.isArray(page?.pendingRevisions) || page.pendingRevisions.length === 0) {
    return false;
  }

  return page.pendingRevisions.some(revision => revision.title === nextTitle && revision.content === nextContent && revision.sectionId === nextSectionId);
}

function hasGroupPermission(data, groupNames, userId, { allowPublicWhenEmpty = false } = {}) {
  if (!userId) return false;
  if (isAdminUser(data, userId)) return true;
  if ((!groupNames || groupNames.length === 0) && allowPublicWhenEmpty) return true;
  const userGroups = new Set(getUserGroupNames(data, userId));
  return (groupNames || []).some(groupName => userGroups.has(groupName));
}

function requireGroupName(name) {
  const normalizedName = normalizeGroupName(name);
  if (!normalizedName) throw new Error('Group name is required');
  return normalizedName;
}

function requireWikiGroupName(name) {
  const normalizedName = normalizeGroupName(name);
  if (!normalizedName) throw new Error('Group name is required');
  if (!normalizedName.startsWith('wiki_')) {
    throw new Error('New groups must start with wiki_');
  }
  return normalizedName;
}

function sanitizeMemberIds(memberIds, data) {
  const validUserIds = new Set(data.users.map(user => user.id));
  return dedupe(memberIds).filter(userId => validUserIds.has(userId));
}

export const wikiDataController = {
  getUserById(userId) {
    return loadData().then(data => getUserById(data, userId));
  },

  async getUsers() {
    const data = await loadData();
    return [...data.users].sort((left, right) => left.name.localeCompare(right.name));
  },

  async getGroups() {
    const data = await loadData();
    return Object.values(data.groups).sort((left, right) => left.name.localeCompare(right.name));
  },

  async getWikiSections() {
    const data = await loadData();
    return Object.values(data.sections).sort((left, right) => left.title.localeCompare(right.title));
  },

  async createGroup(name, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedName = requireGroupName(name);
    if (data.groups[normalizedName]) throw new Error('Group already exists');

    data.groups[normalizedName] = {
      name: normalizedName,
      memberIds: []
    };

    await saveData(data);
    return data.groups[normalizedName];
  },

  async updateGroup(name, memberIds, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedName = requireGroupName(name);
    if (!data.groups[normalizedName]) throw new Error('Group not found');

    data.groups[normalizedName] = {
      name: normalizedName,
      memberIds: sanitizeMemberIds(memberIds || [], data)
    };

    await saveData(data);
    return data.groups[normalizedName];
  },

  async deleteGroup(name, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedName = requireGroupName(name);
    if (!data.groups[normalizedName]) throw new Error('Group not found');
    if (normalizedName === ADMIN_PERMISSION_GROUP) {
      throw new Error('wiki_admin cannot be deleted');
    }

    delete data.groups[normalizedName];

    Object.values(data.sections).forEach(section => {
      section.readGroups = (section.readGroups || []).filter(groupName => groupName !== normalizedName);
      section.writeGroups = (section.writeGroups || []).filter(groupName => groupName !== normalizedName);
      section.approverGroups = (section.approverGroups || []).filter(groupName => groupName !== normalizedName);
    });

    await saveData(data);
  },

  async createWikiSection(title, sectionData, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedTitle = (title || sectionData?.title || '').trim();
    if (!normalizedTitle) throw new Error('Title is required');
    if (data.sections[normalizedTitle]) throw new Error('Section already exists');

    data.sections[normalizedTitle] = {
      title: normalizedTitle,
      readGroups: normalizePermissionGroups(sectionData?.readGroups || []),
      writeGroups: normalizePermissionGroups(sectionData?.writeGroups || []),
      approverGroups: normalizePermissionGroups(sectionData?.approverGroups || []),
      reviewRequired: Boolean(sectionData?.reviewRequired)
    };

    [...data.sections[normalizedTitle].readGroups, ...data.sections[normalizedTitle].writeGroups, ...data.sections[normalizedTitle].approverGroups]
      .forEach(groupName => ensureGroup(data.groups, groupName));

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

    const updatedSection = {
      title: nextTitle,
      readGroups: normalizePermissionGroups(sectionData?.readGroups || []),
      writeGroups: normalizePermissionGroups(sectionData?.writeGroups || []),
      approverGroups: normalizePermissionGroups(sectionData?.approverGroups || []),
      reviewRequired: Boolean(sectionData?.reviewRequired)
    };

    [...updatedSection.readGroups, ...updatedSection.writeGroups, ...updatedSection.approverGroups]
      .forEach(groupName => ensureGroup(data.groups, groupName));

    if (nextTitle !== normalizedTitle) {
      delete data.sections[normalizedTitle];
      data.sections[nextTitle] = updatedSection;

      Object.values(data.pages).forEach(page => {
        if (page.sectionId === normalizedTitle) page.sectionId = nextTitle;
        if (Array.isArray(page.pendingRevisions)) {
          page.pendingRevisions.forEach(revision => {
            if (revision.sectionId === normalizedTitle) revision.sectionId = nextTitle;
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
    if (data.pages.Home?.sectionId === normalizedTitle) {
      throw new Error('Cannot delete the section that contains the Home page');
    }

    delete data.sections[normalizedTitle];

    const defaultSectionTitle = getDefaultSectionTitle(data);
    Object.values(data.pages).forEach(page => {
      if (page.sectionId === normalizedTitle) page.sectionId = defaultSectionTitle;
      if (Array.isArray(page.pendingRevisions)) {
        page.pendingRevisions.forEach(revision => {
          if (revision.sectionId === normalizedTitle) revision.sectionId = defaultSectionTitle;
        });
      }
    });

    await saveData(data);
    return { success: true };
  },

  async createWikiGroup(name, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedName = requireWikiGroupName(name);
    if (data.groups[normalizedName]) throw new Error('Group already exists');

    data.groups[normalizedName] = {
      name: normalizedName,
      memberIds: []
    };

    await saveData(data);
    return data.groups[normalizedName];
  },

  async updateWikiGroup(name, memberIds, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedName = requireWikiGroupName(name);
    if (!data.groups[normalizedName]) throw new Error('Group not found');

    data.groups[normalizedName] = {
      name: normalizedName,
      memberIds: sanitizeMemberIds(memberIds || [], data)
    };

    await saveData(data);
    return data.groups[normalizedName];
  },

  async deleteWikiGroup(name, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedName = requireWikiGroupName(name);
    if (!data.groups[normalizedName]) throw new Error('Group not found');
    if (data.groups[normalizedName].memberIds.includes(userId)) {
      throw new Error('Cannot delete a group you are a member of');
    }

    delete data.groups[normalizedName];

    Object.values(data.sections).forEach(section => {
      section.readGroups = section.readGroups.filter(g => g !== normalizedName);
      section.writeGroups = section.writeGroups.filter(g => g !== normalizedName);
      section.approverGroups = section.approverGroups.filter(g => g !== normalizedName);
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
        return section && hasGroupPermission(data, section.readGroups, userId, { allowPublicWhenEmpty: true });
      })
      .map(page => {
        const head = page.revisions[0] || {};
        return {
          title: page.title,
          sectionId: page.sectionId,
          reviewMode: normalizePageReviewMode(page.reviewMode, page.title === 'Home' ? 'required' : 'inherit'),
          pendingReviewCount: Array.isArray(page.pendingRevisions) ? page.pendingRevisions.length : 0,
          updatedAt: head.timestamp,
          authorId: head.authorId,
          approvedAt: head.approvedAt || head.timestamp,
          approvedBy: head.approvedBy || head.authorId
        };
      });
  },

  async getWikiPage(title, userId) {
    const data = await loadData();
    const page = data.pages[title];
    if (!page) return null;

    const defaultSectionTitle = getDefaultSectionTitle(data);
    const section = data.sections[page.sectionId || defaultSectionTitle];
    if (!section || !hasGroupPermission(data, section.readGroups, userId, { allowPublicWhenEmpty: true })) {
      throw new Error('Permission denied');
    }

    return {
      ...page,
      reviewMode: normalizePageReviewMode(page.reviewMode, page.title === 'Home' ? 'required' : 'inherit'),
      currentRevision: page.revisions[0]
    };
  },

  async saveWikiPage(title, content, userId, sectionId, originalTitle = null) {
    const data = await loadData();
    const normalizedTitle = title?.trim();
    if (!normalizedTitle) throw new Error('Title is required');
    const normalizedOriginalTitle = (originalTitle || normalizedTitle).trim();
    if (!normalizedOriginalTitle) throw new Error('Original title is required');
    if (normalizedOriginalTitle === 'Home' && normalizedTitle !== 'Home') {
      throw new Error('The Home page cannot be renamed');
    }
    if (normalizedTitle !== normalizedOriginalTitle && data.pages[normalizedTitle]) {
      throw new Error('Page already exists');
    }

    let page = data.pages[normalizedOriginalTitle];
    const defaultSectionTitle = getDefaultSectionTitle(data);
    const targetSectionId = sectionId || (page ? page.sectionId : defaultSectionTitle);
    const section = data.sections[targetSectionId];
    if (!section) throw new Error('Invalid section');
    if (!getUserById(data, userId)) throw new Error('User not found');
    if (!hasGroupPermission(data, section.writeGroups, userId, { allowPublicWhenEmpty: true })) throw new Error('Permission denied');
    if (!hasWikiPageChanges(page, normalizedTitle, content, targetSectionId)) throw new Error('No changes to save');

    const reviewRequired = isPageReviewRequired(page, section);

    if (reviewRequired) {
      if (hasPendingWikiPageChanges(page, normalizedTitle, content, targetSectionId)) {
        throw new Error('No changes to save');
      }

      if (!page) {
        page = {
          title: normalizedTitle,
          sectionId: targetSectionId,
          reviewMode: normalizePageReviewMode(null, normalizedTitle === 'Home' ? 'required' : 'inherit'),
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
        reviewMode: normalizePageReviewMode(null, normalizedTitle === 'Home' ? 'required' : 'inherit'),
        revisions: []
      };
      data.pages[normalizedTitle] = page;
    } else {
      if (normalizedOriginalTitle !== normalizedTitle) {
        delete data.pages[normalizedOriginalTitle];
        data.pages[normalizedTitle] = page;
      }
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
    const approverGroups = getPageApproverGroups(page, section);
    if (!section || !hasGroupPermission(data, approverGroups, userId)) {
      throw new Error('Permission denied');
    }
    if (userId === pendingRevision.authorId && !isAdminUser(data, userId)) {
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
    const approverGroups = getPageApproverGroups(page, section);
    if (!section || !hasGroupPermission(data, approverGroups, userId)) {
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
    if (!isAdminUser(data, userId)) throw new Error('Permission denied');

    const targetRevision = page.revisions.find(revision => revision.version === parseInt(version, 10));
    if (!targetRevision) return null;

    return this.saveWikiPage(page.title, targetRevision.content, userId, page.sectionId);
  },

  async updateWikiPageReviewMode(title, reviewMode, userId) {
    const data = await loadData();
    await checkAdmin(userId, data);

    const normalizedTitle = (title || '').trim();
    if (!normalizedTitle) throw new Error('Title is required');

    const page = data.pages[normalizedTitle];
    if (!page) throw new Error('Page not found');

    page.reviewMode = normalizePageReviewMode(reviewMode, normalizedTitle === 'Home' ? 'required' : 'inherit');

    await saveData(data);
    return page;
  }
};