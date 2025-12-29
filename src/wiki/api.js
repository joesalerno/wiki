
/* API Adapter */
export const API = {
  async fetchInit() {
    const res = await fetch('/api/init');
    if (!res.ok) throw new Error('Failed to fetch init data');
    return res.json();
  },

  async fetchPage(id) {
    const res = await fetch(`/api/page/${id}`);
    if (!res.ok) throw new Error('Failed to fetch page');
    return res.json();
  },

  async savePage(pageData) {
    const res = await fetch('/api/page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageData),
    });
    if (!res.ok) throw new Error('Failed to save page');
    return res.json();
  },

  async approveRevision(revisionId) {
    const res = await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionId }),
    });
    if (!res.ok) throw new Error('Failed to approve revision');
    return res.json();
  }
};
