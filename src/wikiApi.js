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
const resolveWikiUserId = (userId) => userId || getCurrentWikiUserId();

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
  reader.readAsDataURL(file);
});

export const wikiApi = {
  async getUsers() {
    const data = await gqlRequest(
      `query GetUsers {
        users { id name }
      }`
    );
    return data.users;
  },

  async getGroups() {
    const data = await gqlRequest(
      `query GetGroups {
        groups {
          name
          users {
            id
            name
          }
        }
      }`
    );
    return data.groups;
  },

  async getWikiSections() {
    const data = await gqlRequest(
      `query GetWikiSections {
        wikiSections {
          title
          readGroups
          writeGroups
          approverGroups
          reviewRequired
        }
      }`
    );
    return data.wikiSections;
  },

  async createWikiSection(sectionInput, userId) {
    const resolvedUserId = resolveWikiUserId(userId);
    const result = await gqlRequest(
      `mutation CreateWikiSection($input: WikiSectionInput!, $userId: ID) {
        createWikiSection(input: $input, userId: $userId) {
          title
          readGroups
          writeGroups
          approverGroups
          reviewRequired
        }
      }`,
      { input: sectionInput, userId: resolvedUserId }
    );
    return result.createWikiSection;
  },

  async updateWikiSection(title, sectionInput, userId) {
    const resolvedUserId = resolveWikiUserId(userId);
    const result = await gqlRequest(
      `mutation UpdateWikiSection($title: String!, $input: WikiSectionInput!, $userId: ID) {
        updateWikiSection(title: $title, input: $input, userId: $userId) {
          title
          readGroups
          writeGroups
          approverGroups
          reviewRequired
        }
      }`,
      { title, input: sectionInput, userId: resolvedUserId }
    );
    return result.updateWikiSection;
  },

  async createWikiGroup(name, userId) {
    const resolvedUserId = resolveWikiUserId(userId);
    const result = await gqlRequest(
      `mutation CreateWikiGroup($name: String!, $userId: ID) {
        createWikiGroup(name: $name, userId: $userId) {
          name
          users {
            id
            name
          }
        }
      }`,
      { name, userId: resolvedUserId }
    );
    return result.createWikiGroup;
  },

  async updateWikiGroup(name, memberIds, userId) {
    const resolvedUserId = resolveWikiUserId(userId);
    const result = await gqlRequest(
      `mutation UpdateWikiGroup($name: String!, $memberIds: [ID!]!, $userId: ID) {
        updateWikiGroup(name: $name, memberIds: $memberIds, userId: $userId) {
          name
          users {
            id
            name
          }
        }
      }`,
      { name, memberIds, userId: resolvedUserId }
    );
    return result.updateWikiGroup;
  },

  async deleteWikiGroup(name, userId) {
    const resolvedUserId = resolveWikiUserId(userId);
    const result = await gqlRequest(
      `mutation DeleteWikiGroup($name: String!, $userId: ID) {
        deleteWikiGroup(name: $name, userId: $userId)
      }`,
      { name, userId: resolvedUserId }
    );
    return result.deleteWikiGroup;
  },

  async deleteWikiSection(title, userId) {
    const resolvedUserId = resolveWikiUserId(userId);
    const result = await gqlRequest(
      `mutation DeleteWikiSection($title: String!, $userId: ID) {
        deleteWikiSection(title: $title, userId: $userId)
      }`,
      { title, userId: resolvedUserId }
    );
    return result.deleteWikiSection;
  },

  async getWikiPages(userId) {
    const resolvedUserId = resolveWikiUserId(userId);
    const data = await gqlRequest(
      `query GetWikiPages($userId: ID) {
        wikiPages(userId: $userId) {
          title
          sectionId
          reviewMode
          pendingReviewCount
          updatedAt
          authorId
          approvedAt
          approvedBy
        }
      }`,
      { userId: resolvedUserId },
      resolvedUserId
    );
    return data.wikiPages;
  },

  async getWikiPage(title, userId) {
    const resolvedUserId = resolveWikiUserId(userId);
    const data = await gqlRequest(
      `query GetWikiPage($title: ID!, $userId: ID) {
        wikiPage(title: $title, userId: $userId) {
          title
          sectionId
          reviewMode
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
      { title, userId: resolvedUserId },
      resolvedUserId
    );
    return data.wikiPage;
  },

  async updateWikiPageReviewMode(title, reviewMode, userId) {
    const resolvedUserId = resolveWikiUserId(userId);
    const data = await gqlRequest(
      `mutation UpdateWikiPageReviewMode($title: ID!, $reviewMode: String!, $userId: ID) {
        updateWikiPageReviewMode(title: $title, reviewMode: $reviewMode, userId: $userId) {
          title
          sectionId
          reviewMode
        }
      }`,
      { title, reviewMode, userId: resolvedUserId },
      resolvedUserId
    );
    return data.updateWikiPageReviewMode;
  },

  async saveWikiPage(title, content, userId, sectionId, originalTitle) {
    const data = await gqlRequest(
      `mutation SaveWikiPage($title: String!, $content: String!, $userId: ID!, $sectionId: ID, $originalTitle: String) {
        saveWikiPage(title: $title, content: $content, userId: $userId, sectionId: $sectionId, originalTitle: $originalTitle) {
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
      { title, content, userId, sectionId, originalTitle },
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
  },

  async uploadAsset(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const [meta, contentBase64] = dataUrl.split(',');
    const mimeMatch = meta?.match(/^data:(.*);base64$/);
    const mimeType = mimeMatch?.[1] || file.type || 'application/octet-stream';

    const result = await gqlRequest(
      `mutation UploadAsset($fileName: String!, $mimeType: String!, $contentBase64: String!) {
        uploadAsset(fileName: $fileName, mimeType: $mimeType, contentBase64: $contentBase64) {
          fileName
          mimeType
          isImage
          url
          markdown
        }
      }`,
      { fileName: file.name, mimeType, contentBase64 }
    );
    return result.uploadAsset;
  }
};