
const API_URL = 'http://localhost:3001/graphql';

const gqlRequest = async (query, variables = {}, userId) => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'X-User-ID': userId } : {})
    },
    body: JSON.stringify({ query, variables })
  });

  const payload = await res.json();
  if (!res.ok || payload.errors) {
    const message = payload.errors?.[0]?.message || 'Request failed';
    throw new Error(message);
  }
  return payload.data;
};

const getCurrentUserId = () => localStorage.getItem('wiki_user_id') || 'u3';

export const db = {
  async getUsers() {
    const data = await gqlRequest(
      `query {
        users { id name isAdmin }
      }`
    );
    return data.users;
  },

  async getSections() {
    const data = await gqlRequest(
      `query {
        sections {
          id
          title
          readUsers
          writeUsers
          approverUsers
          reviewRequired
        }
      }`
    );
    return data.sections;
  },

  async createSection(id, data) {
    const userId = getCurrentUserId();
    const result = await gqlRequest(
      `mutation CreateSection($id: ID!, $input: SectionInput!, $userId: ID) {
        createSection(id: $id, input: $input, userId: $userId) {
          id
          title
          readUsers
          writeUsers
          approverUsers
          reviewRequired
        }
      }`,
      { id, input: data, userId }
    );
    return result.createSection;
  },

  async updateSection(id, data) {
    const userId = getCurrentUserId();
    const result = await gqlRequest(
      `mutation UpdateSection($id: ID!, $input: SectionInput!, $userId: ID) {
        updateSection(id: $id, input: $input, userId: $userId) {
          id
          title
          readUsers
          writeUsers
          approverUsers
          reviewRequired
        }
      }`,
      { id, input: data, userId }
    );
    return result.updateSection;
  },

  async deleteSection(id) {
    const userId = getCurrentUserId();
    const result = await gqlRequest(
      `mutation DeleteSection($id: ID!, $userId: ID) {
        deleteSection(id: $id, userId: $userId)
      }`,
      { id, userId }
    );
    return result.deleteSection;
  },

  async getPages() {
    const userId = getCurrentUserId();
    const data = await gqlRequest(
      `query Pages($userId: ID) {
        pages(userId: $userId) {
          slug
          title
          sectionId
          updatedAt
          authorId
        }
      }`,
      { userId },
      userId
    );
    return data.pages;
  },

  async getPage(slug) {
    const userId = getCurrentUserId();
    const data = await gqlRequest(
      `query Page($slug: ID!, $userId: ID) {
        page(slug: $slug, userId: $userId) {
          id
          slug
          title
          sectionId
          revisions {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
          pendingRevisions {
            content
            title
            authorId
            timestamp
            sectionId
          }
          currentRevision {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
        }
      }`,
      { slug, userId },
      userId
    );
    return data.page;
  },

  async savePage(slug, title, content, userId, sectionId) {
    const data = await gqlRequest(
      `mutation SavePage($slug: ID!, $title: String!, $content: String!, $userId: ID!, $sectionId: ID) {
        savePage(slug: $slug, title: $title, content: $content, userId: $userId, sectionId: $sectionId) {
          id
          slug
          title
          sectionId
          status
          revisions {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
          pendingRevisions {
            content
            title
            authorId
            timestamp
            sectionId
          }
          currentRevision {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
        }
      }`,
      { slug, title, content, userId, sectionId },
      userId
    );
    return data.savePage;
  },

  async approveRevision(slug, index, userId) {
    const data = await gqlRequest(
      `mutation ApproveRevision($slug: ID!, $index: Int!, $userId: ID!) {
        approveRevision(slug: $slug, index: $index, userId: $userId) {
          id
          slug
          title
          sectionId
          revisions {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
          pendingRevisions {
            content
            title
            authorId
            timestamp
            sectionId
          }
          currentRevision {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
        }
      }`,
      { slug, index, userId },
      userId
    );
    return data.approveRevision;
  },

  async rejectRevision(slug, index, userId) {
    const data = await gqlRequest(
      `mutation RejectRevision($slug: ID!, $index: Int!, $userId: ID!) {
        rejectRevision(slug: $slug, index: $index, userId: $userId) {
          id
          slug
          title
          sectionId
          revisions {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
          pendingRevisions {
            content
            title
            authorId
            timestamp
            sectionId
          }
          currentRevision {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
        }
      }`,
      { slug, index, userId },
      userId
    );
    return data.rejectRevision;
  },

  async getHistory(slug) {
    const data = await gqlRequest(
      `query History($slug: ID!) {
        history(slug: $slug) {
          version
          content
          authorId
          timestamp
          approvedBy
          approvedAt
        }
      }`,
      { slug }
    );
    return data.history;
  },

  async revert(slug, version, userId) {
    const data = await gqlRequest(
      `mutation Revert($slug: ID!, $version: Int!, $userId: ID!) {
        revert(slug: $slug, version: $version, userId: $userId) {
          id
          slug
          title
          sectionId
          revisions {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
          pendingRevisions {
            content
            title
            authorId
            timestamp
            sectionId
          }
          currentRevision {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
        }
      }`,
      { slug, version, userId },
      userId
    );
    return data.revert;
  }
};
