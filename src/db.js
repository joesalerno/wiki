
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

  async createUser(user) {
      const userId = localStorage.getItem('wiki_user_id') || 'u3';
      const res = await fetch(`${API_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
          body: JSON.stringify(user)
      });
      if (!res.ok) throw await res.json();
      return await res.json();
  },

  async updateUser(id, user) {
      const userId = localStorage.getItem('wiki_user_id') || 'u3';
      const res = await fetch(`${API_URL}/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
          body: JSON.stringify(user)
      });
      if (!res.ok) throw await res.json();
      return await res.json();
  },

  async deleteUser(id) {
      const userId = localStorage.getItem('wiki_user_id') || 'u3';
      const res = await fetch(`${API_URL}/users/${id}`, {
          method: 'DELETE',
          headers: { 'X-User-ID': userId }
      });
      if (!res.ok) throw await res.json();
      return await res.json();
  },

  async getGroups() {
    const res = await fetch(`${API_URL}/groups`);
    return await res.json();
  },

  async createGroup(id, groupData) {
      const userId = localStorage.getItem('wiki_user_id') || 'u3';
      const res = await fetch(`${API_URL}/groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
          body: JSON.stringify({ id, ...groupData })
      });
      if (!res.ok) throw await res.json();
      return await res.json();
  },

  async updateGroup(id, groupData) {
      const userId = localStorage.getItem('wiki_user_id') || 'u3';
      const res = await fetch(`${API_URL}/groups/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
          body: JSON.stringify(groupData)
      });
      if (!res.ok) throw await res.json();
      return await res.json();
  },

  async deleteGroup(id) {
      const userId = localStorage.getItem('wiki_user_id') || 'u3';
      const res = await fetch(`${API_URL}/groups/${id}`, {
          method: 'DELETE',
          headers: { 'X-User-ID': userId }
      });
      if (!res.ok) throw await res.json();
      return await res.json();
  },

  async getSections() {
    const res = await fetch(`${API_URL}/sections`);
    return await res.json();
  },

  async createSection(id, sectionData) {
      const userId = localStorage.getItem('wiki_user_id') || 'u3';
      const res = await fetch(`${API_URL}/sections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
          body: JSON.stringify({ id, ...sectionData })
      });
      if (!res.ok) throw await res.json();
      return await res.json();
  },

  async updateSection(id, sectionData) {
      const userId = localStorage.getItem('wiki_user_id') || 'u3';
      const res = await fetch(`${API_URL}/sections/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
          body: JSON.stringify(sectionData)
      });
      if (!res.ok) throw await res.json();
      return await res.json();
  },

  async deleteSection(id) {
      const userId = localStorage.getItem('wiki_user_id') || 'u3';
      const res = await fetch(`${API_URL}/sections/${id}`, {
          method: 'DELETE',
          headers: { 'X-User-ID': userId }
      });
      if (!res.ok) throw await res.json();
      return await res.json();
  },

  async getPages() {
    // We need to send user ID.
    // In a real app we'd have a token. Here we rely on localStorage or similar,
    // but the `Wiki` component manages `currentUser` state.
    // We can't easily access React state from here without passing it.
    // The previous implementation of `getPages` didn't take args.
    // This is a refactoring challenge.

    // Simplest solution for this task:
    // We store the selected user ID in localStorage whenever it changes in Wiki.jsx,
    // and read it here.
    const userId = localStorage.getItem('wiki_user_id') || 'u3'; // Default to viewer
    const res = await fetch(`${API_URL}/pages`, {
        headers: { 'X-User-ID': userId }
    });
    return await res.json();
  },

  async getPage(slug) {
    const userId = localStorage.getItem('wiki_user_id') || 'u3';
    const res = await fetch(`${API_URL}/pages/${slug}`, {
        headers: { 'X-User-ID': userId }
    });
    if (!res.ok) return null;
    return await res.json();
  },

  async savePage(slug, title, content, user, sectionId) {
    const res = await fetch(`${API_URL}/pages/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, user, sectionId })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
    }
    return await res.json();
  },

  async approveRevision(slug, index, user) {
     const res = await fetch(`${API_URL}/pages/${slug}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, user })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to approve');
    }
    return await res.json();
  },

  async rejectRevision(slug, index, user) {
     const res = await fetch(`${API_URL}/pages/${slug}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, user })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reject');
    }
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
  }
};
