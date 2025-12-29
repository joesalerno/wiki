
const API_URL = 'http://localhost:3001/api';

export const db = {
  // Init is now just a placeholder or could check server health, but we'll leave it simple
  async init() {
  },

  async getUsers() {
    const res = await fetch(`${API_URL}/users`);
    return await res.json();
  },

  async getUser(id) {
    // We don't have a specific endpoint but we can fetch all or just filter client side for now to match old API
    const users = await this.getUsers();
    return users.find(u => u.id === id);
  },

  async getGroups() {
    const res = await fetch(`${API_URL}/groups`);
    return await res.json();
  },

  async getSections() {
    const res = await fetch(`${API_URL}/sections`);
    return await res.json();
  },

  async getSection(id) {
    const res = await fetch(`${API_URL}/sections/${id}`);
    if (!res.ok) return null;
    return await res.json();
  },

  async saveSection(section) {
    const res = await fetch(`${API_URL}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(section)
    });
    return await res.json();
  },

  async getPages() {
    const res = await fetch(`${API_URL}/pages`);
    return await res.json();
  },

  async getPage(slug) {
    const res = await fetch(`${API_URL}/pages/${slug}`);
    if (!res.ok) return null;
    return await res.json();
  },

  async savePage(slug, title, content, user, sectionId) {
    const res = await fetch(`${API_URL}/pages/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, user, sectionId })
    });
    return await res.json();
  },

  async getHistory(slug) {
    const res = await fetch(`${API_URL}/pages/${slug}/history`);
    if (!res.ok) return [];
    return await res.json();
  },

  async revert(slug, version, user) {
     const res = await fetch(`${API_URL}/pages/${slug}/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, user })
    });
    if (!res.ok) return null;
    return await res.json();
  },

  async getPendingReviews() {
    const res = await fetch(`${API_URL}/reviews`);
    if (!res.ok) return [];
    return await res.json();
  },

  async approveRevision(slug, revisionId, user) {
     const res = await fetch(`${API_URL}/reviews/${slug}/${revisionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user })
    });
    return await res.json();
  },

  async rejectRevision(slug, revisionId, user) {
     const res = await fetch(`${API_URL}/reviews/${slug}/${revisionId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user })
    });
    return await res.json();
  }
};
