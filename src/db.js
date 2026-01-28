
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

  async createSection(data) {
    const userId = getCurrentUserId();
    const result = await gqlRequest(
      `mutation CreateSection($input: SectionInput!, $userId: ID) {
        createSection(input: $input, userId: $userId) {
          title
          readUsers
          writeUsers
          approverUsers
          reviewRequired
        }
      }`,
      { input: data, userId }
    );
    return result.createSection;
  },

  async updateSection(title, data) {
    const userId = getCurrentUserId();
    const result = await gqlRequest(
      `mutation UpdateSection($title: String!, $input: SectionInput!, $userId: ID) {
        updateSection(title: $title, input: $input, userId: $userId) {
          title
          readUsers
          writeUsers
          approverUsers
          reviewRequired
        }
      }`,
      { title, input: data, userId }
    );
    return result.updateSection;
  },

  async deleteSection(title) {
    const userId = getCurrentUserId();
    const result = await gqlRequest(
      `mutation DeleteSection($title: String!, $userId: ID) {
        deleteSection(title: $title, userId: $userId)
      }`,
      { title, userId }
    );
    return result.deleteSection;
  },

  async getPages() {
    const userId = getCurrentUserId();
    const data = await gqlRequest(
      `query Pages($userId: ID) {
        pages(userId: $userId) {
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

  async getPage(title) {
    const userId = getCurrentUserId();
    const data = await gqlRequest(
      `query Page($title: ID!, $userId: ID) {
        page(title: $title, userId: $userId) {
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
      { title, userId },
      userId
    );
    return data.page;
  },

  async savePage(title, content, userId, sectionId) {
    const data = await gqlRequest(
      `mutation SavePage($title: String!, $content: String!, $userId: ID!, $sectionId: ID) {
        savePage(title: $title, content: $content, userId: $userId, sectionId: $sectionId) {
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
      { title, content, userId, sectionId },
      userId
    );
    return data.savePage;
  },

  async approveRevision(title, index, userId) {
    const data = await gqlRequest(
      `mutation ApproveRevision($title: ID!, $index: Int!, $userId: ID!) {
        approveRevision(title: $title, index: $index, userId: $userId) {
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
      { title, index, userId },
      userId
    );
    return data.approveRevision;
  },

  async rejectRevision(title, index, userId) {
    const data = await gqlRequest(
      `mutation RejectRevision($title: ID!, $index: Int!, $userId: ID!) {
        rejectRevision(title: $title, index: $index, userId: $userId) {
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
      { title, index, userId },
      userId
    );
    return data.rejectRevision;
  },

  async getHistory(title) {
    const data = await gqlRequest(
      `query History($title: ID!) {
        history(title: $title) {
          version
          content
          authorId
          timestamp
          approvedBy
          approvedAt
        }
      }`,
      { title }
    );
    return data.history;
  },

  async revert(title, version, userId) {
    const data = await gqlRequest(
      `mutation Revert($title: ID!, $version: Int!, $userId: ID!) {
        revert(title: $title, version: $version, userId: $userId) {
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
      { title, version, userId },
      userId
    );
    return data.revert;
  }
};
