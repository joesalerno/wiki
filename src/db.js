import { client } from './apolloClient.js';
import { gql } from '@apollo/client';

export const db = {
  // Init is now just a placeholder
  async init() {
  },

  async getUsers() {
    const { data } = await client.query({
      query: gql`
        query GetUsers {
          users {
            id
            name
            groups
          }
        }
      `
    });
    return data.users;
  },

  async getUser(id) {
    // In GraphQL we fetch all and filter or specific.
    // Reusing getUsers for simplicity as per original implementation
    const users = await this.getUsers();
    return users.find(u => u.id === id);
  },

  async getGroups() {
    const { data } = await client.query({
      query: gql`
        query GetGroups {
            groups {
                id
                permissions
            }
        }
      `
    });
    // Convert back to object format expected by app { id: { permissions: [] } }
    const groups = {};
    data.groups.forEach(g => {
        groups[g.id] = { permissions: g.permissions };
    });
    return groups;
  },

  async createGroup(id, data) {
    const { data: res } = await client.mutate({
        mutation: gql`
            mutation CreateGroup($id: ID!, $permissions: [String]!) {
                createGroup(id: $id, permissions: $permissions) {
                    id
                    permissions
                }
            }
        `,
        variables: { id, permissions: data.permissions }
    });
    return res.createGroup;
  },

  async updateGroup(id, data) {
    const { data: res } = await client.mutate({
        mutation: gql`
            mutation UpdateGroup($id: ID!, $permissions: [String]) {
                updateGroup(id: $id, permissions: $permissions) {
                    id
                    permissions
                }
            }
        `,
        variables: { id, permissions: data.permissions }
    });
    return res.updateGroup;
  },

  async deleteGroup(id) {
    const { data: res } = await client.mutate({
        mutation: gql`
            mutation DeleteGroup($id: ID!) {
                deleteGroup(id: $id) {
                    success
                }
            }
        `,
        variables: { id }
    });
    return res.deleteGroup;
  },

  async getSections() {
    const { data } = await client.query({
      query: gql`
        query GetSections {
          sections {
            id
            title
            readGroups
            writeGroups
            reviewRequired
            approverGroups
          }
        }
      `
    });
    // Convert array back to object keyed by ID
    const sections = {};
    data.sections.forEach(s => {
        sections[s.id] = s;
    });
    return sections;
  },

  async createSection(id, data) {
    const { data: res } = await client.mutate({
        mutation: gql`
            mutation CreateSection($id: ID!, $title: String!, $readGroups: [String]!, $writeGroups: [String]!, $reviewRequired: Boolean, $approverGroups: [String]) {
                createSection(id: $id, title: $title, readGroups: $readGroups, writeGroups: $writeGroups, reviewRequired: $reviewRequired, approverGroups: $approverGroups) {
                    id
                    title
                    readGroups
                    writeGroups
                    reviewRequired
                    approverGroups
                }
            }
        `,
        variables: { id, ...data }
    });
    return res.createSection;
  },

  async updateSection(id, data) {
     const { data: res } = await client.mutate({
        mutation: gql`
            mutation UpdateSection($id: ID!, $title: String, $readGroups: [String], $writeGroups: [String], $reviewRequired: Boolean, $approverGroups: [String]) {
                updateSection(id: $id, title: $title, readGroups: $readGroups, writeGroups: $writeGroups, reviewRequired: $reviewRequired, approverGroups: $approverGroups) {
                    id
                    title
                    readGroups
                    writeGroups
                    reviewRequired
                    approverGroups
                }
            }
        `,
        variables: { id, ...data }
    });
    return res.updateSection;
  },

  async deleteSection(id) {
    const { data: res } = await client.mutate({
        mutation: gql`
            mutation DeleteSection($id: ID!) {
                deleteSection(id: $id) {
                    success
                }
            }
        `,
        variables: { id }
    });
    return res.deleteSection;
  },

  async createUser(user) {
    const { data: res } = await client.mutate({
        mutation: gql`
            mutation CreateUser($id: ID!, $name: String!, $groups: [String]!) {
                createUser(id: $id, name: $name, groups: $groups) {
                    id
                    name
                    groups
                }
            }
        `,
        variables: user
    });
    return res.createUser;
  },

  async updateUser(id, data) {
    const { data: res } = await client.mutate({
        mutation: gql`
            mutation UpdateUser($id: ID!, $name: String, $groups: [String]) {
                updateUser(id: $id, name: $name, groups: $groups) {
                    id
                    name
                    groups
                }
            }
        `,
        variables: { id, ...data }
    });
    return res.updateUser;
  },

  async deleteUser(id) {
    const { data: res } = await client.mutate({
        mutation: gql`
            mutation DeleteUser($id: ID!) {
                deleteUser(id: $id) {
                    success
                }
            }
        `,
        variables: { id }
    });
    return res.deleteUser;
  },

  async getPages() {
    const { data } = await client.query({
      query: gql`
        query GetPages {
          pages {
            slug
            title
            sectionId
            updatedAt
            authorId
          }
        }
      `
    });
    return data.pages;
  },

  async getPage(slug) {
    try {
        const { data } = await client.query({
        query: gql`
            query GetPage($slug: String!) {
            page(slug: $slug) {
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
                }
            }
            }
        `,
        variables: { slug }
        });
        return data.page;
    } catch {
        return null;
    }
  },

  async savePage(slug, title, content, _user, sectionId) {
    const { data } = await client.mutate({
        mutation: gql`
            mutation SavePage($slug: String!, $title: String!, $content: String!, $sectionId: String) {
                savePage(slug: $slug, title: $title, content: $content, sectionId: $sectionId) {
                    slug
                    status
                }
            }
        `,
        variables: { slug, title, content, sectionId }
    });
    return data.savePage;
  },

  async approveRevision(slug, index) {
     const { data } = await client.mutate({
        mutation: gql`
            mutation ApproveRevision($slug: String!, $index: Int!) {
                approveRevision(slug: $slug, index: $index) {
                    slug
                }
            }
        `,
        variables: { slug, index }
     });
     return data.approveRevision;
  },

  async rejectRevision(slug, index) {
     const { data } = await client.mutate({
        mutation: gql`
            mutation RejectRevision($slug: String!, $index: Int!) {
                rejectRevision(slug: $slug, index: $index) {
                    slug
                }
            }
        `,
        variables: { slug, index }
     });
     return data.rejectRevision;
  },

  async getHistory(slug) {
    const { data } = await client.query({
      query: gql`
        query GetHistory($slug: String!) {
          history(slug: $slug) {
            version
            content
            authorId
            timestamp
            approvedBy
            approvedAt
          }
        }
      `,
      variables: { slug }
    });
    return data.history;
  },

  async revert(slug, version) {
     const { data } = await client.mutate({
        mutation: gql`
            mutation RevertPage($slug: String!, $version: Int!) {
                revertPage(slug: $slug, version: $version) {
                    slug
                }
            }
        `,
        variables: { slug, version }
     });
     return data.revertPage;
  }
};
