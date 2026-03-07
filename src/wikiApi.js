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

const getCurrentWikiUserId = () => localStorage.getItem('wiki_user_id') || 'u3';

export const wikiApi = {
  async getWikiUsers() {
    const data = await gqlRequest(
      `query GetWikiUsers {
        wikiUsers { id name isAdmin }
      }`
    );
    return data.wikiUsers;
  },

  async getWikiSections() {
    const data = await gqlRequest(
      `query GetWikiSections {
        wikiSections {
          title
          readUsers
          writeUsers
          approverUsers
          reviewRequired
        }
      }`
    );
    return data.wikiSections;
  },

  async createWikiSection(sectionInput) {
    const userId = getCurrentWikiUserId();
    const result = await gqlRequest(
      `mutation CreateWikiSection($input: WikiSectionInput!, $userId: ID) {
        createWikiSection(input: $input, userId: $userId) {
          title
          readUsers
          writeUsers
          approverUsers
          reviewRequired
        }
      }`,
      { input: sectionInput, userId }
    );
    return result.createWikiSection;
  },

  async updateWikiSection(title, sectionInput) {
    const userId = getCurrentWikiUserId();
    const result = await gqlRequest(
      `mutation UpdateWikiSection($title: String!, $input: WikiSectionInput!, $userId: ID) {
        updateWikiSection(title: $title, input: $input, userId: $userId) {
          title
          readUsers
          writeUsers
          approverUsers
          reviewRequired
        }
      }`,
      { title, input: sectionInput, userId }
    );
    return result.updateWikiSection;
  },

  async deleteWikiSection(title) {
    const userId = getCurrentWikiUserId();
    const result = await gqlRequest(
      `mutation DeleteWikiSection($title: String!, $userId: ID) {
        deleteWikiSection(title: $title, userId: $userId)
      }`,
      { title, userId }
    );
    return result.deleteWikiSection;
  },

  async getWikiPages() {
    const userId = getCurrentWikiUserId();
    const data = await gqlRequest(
      `query GetWikiPages($userId: ID) {
        wikiPages(userId: $userId) {
          title
          sectionId
          updatedAt
          authorId
        }
      }`,
      { userId },
      userId
    );
    return data.wikiPages;
  },

  async getWikiPage(title) {
    const userId = getCurrentWikiUserId();
    const data = await gqlRequest(
      `query GetWikiPage($title: ID!, $userId: ID) {
        wikiPage(title: $title, userId: $userId) {
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
    return data.wikiPage;
  },

  async saveWikiPage(title, content, userId, sectionId) {
    const data = await gqlRequest(
      `mutation SaveWikiPage($title: String!, $content: String!, $userId: ID!, $sectionId: ID) {
        saveWikiPage(title: $title, content: $content, userId: $userId, sectionId: $sectionId) {
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
    return data.saveWikiPage;
  },

  async approveWikiRevision(title, index, userId) {
    const data = await gqlRequest(
      `mutation ApproveWikiRevision($title: ID!, $index: Int!, $userId: ID!) {
        approveWikiRevision(title: $title, index: $index, userId: $userId) {
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
    return data.approveWikiRevision;
  },

  async rejectWikiRevision(title, index, userId) {
    const data = await gqlRequest(
      `mutation RejectWikiRevision($title: ID!, $index: Int!, $userId: ID!) {
        rejectWikiRevision(title: $title, index: $index, userId: $userId) {
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
    return data.rejectWikiRevision;
  },

  async getWikiPageHistory(title) {
    const data = await gqlRequest(
      `query GetWikiPageHistory($title: ID!) {
        wikiPageHistory(title: $title) {
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
    return data.wikiPageHistory;
  },

  async revertWikiPage(title, version, userId) {
    const data = await gqlRequest(
      `mutation RevertWikiPage($title: ID!, $version: Int!, $userId: ID!) {
        revertWikiPage(title: $title, version: $version, userId: $userId) {
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
    return data.revertWikiPage;
  }
};