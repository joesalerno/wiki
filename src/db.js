import { client } from './apolloClient.js';
import { gql } from '@apollo/client';

const GET_USERS = gql`
  query GetUsers {
    users {
      id
      name
      groups
    }
  }
`;

const GET_GROUPS = gql`
  query GetGroups {
    groups {
      id
      permissions
    }
  }
`;

const GET_SECTIONS = gql`
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
`;

const GET_PAGES = gql`
  query GetPages {
    pages {
      id
      slug
      title
      sectionId
      updatedAt
      authorId
    }
  }
`;

const GET_PAGE = gql`
  query GetPage($slug: String!) {
    page(slug: $slug) {
      id
      slug
      title
      sectionId
      currentRevision {
        version
        content
        authorId
        timestamp
        approvedBy
        approvedAt
      }
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
    }
  }
`;

const GET_HISTORY = gql`
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
`;

const CREATE_USER = gql`
  mutation CreateUser($user: UserInput!) {
    createUser(user: $user) {
      id
      name
      groups
    }
  }
`;

const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $user: UserInput!) {
    updateUser(id: $id, user: $user) {
      id
      name
      groups
    }
  }
`;

const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id)
  }
`;

const CREATE_GROUP = gql`
  mutation CreateGroup($id: ID!, $group: GroupInput!) {
    createGroup(id: $id, group: $group) {
      id
      permissions
    }
  }
`;

const UPDATE_GROUP = gql`
  mutation UpdateGroup($id: ID!, $group: GroupInput!) {
    updateGroup(id: $id, group: $group) {
      id
      permissions
    }
  }
`;

const DELETE_GROUP = gql`
  mutation DeleteGroup($id: ID!) {
    deleteGroup(id: $id)
  }
`;

const CREATE_SECTION = gql`
  mutation CreateSection($id: ID!, $section: SectionInput!) {
    createSection(id: $id, section: $section) {
      id
      title
      readGroups
      writeGroups
      reviewRequired
      approverGroups
    }
  }
`;

const UPDATE_SECTION = gql`
  mutation UpdateSection($id: ID!, $section: SectionInput!) {
    updateSection(id: $id, section: $section) {
      id
      title
      readGroups
      writeGroups
      reviewRequired
      approverGroups
    }
  }
`;

const DELETE_SECTION = gql`
  mutation DeleteSection($id: ID!) {
    deleteSection(id: $id)
  }
`;

const SAVE_PAGE = gql`
  mutation SavePage($slug: String!, $title: String!, $content: String!, $sectionId: String) {
    savePage(slug: $slug, title: $title, content: $content, sectionId: $sectionId) {
      id
      slug
      title
      sectionId
      status
    }
  }
`;

const APPROVE_REVISION = gql`
  mutation ApproveRevision($slug: String!, $index: Int!) {
    approveRevision(slug: $slug, index: $index) {
      id
      slug
    }
  }
`;

const REJECT_REVISION = gql`
  mutation RejectRevision($slug: String!, $index: Int!) {
    rejectRevision(slug: $slug, index: $index) {
      id
      slug
    }
  }
`;

const REVERT_PAGE = gql`
  mutation RevertPage($slug: String!, $version: Int!) {
    revertPage(slug: $slug, version: $version) {
      id
      slug
    }
  }
`;


export const db = {
  async init() {
  },

  async getUsers() {
    const res = await client.query({ query: GET_USERS });
    return res.data.users;
  },

  async getUser(id) {
    const users = await this.getUsers();
    return users.find(u => u.id === id);
  },

  async getGroups() {
    const res = await client.query({ query: GET_GROUPS });
    const groupsList = res.data.groups;
    const groupsMap = {};
    groupsList.forEach(g => {
        // eslint-disable-next-line no-unused-vars
        const { id, ...rest } = g;
        groupsMap[g.id] = rest;
    });
    return groupsMap;
  },

  async createGroup(id, data) {
    try {
        const res = await client.mutate({
            mutation: CREATE_GROUP,
            variables: { id, group: data }
        });
        return res.data.createGroup;
    } catch (e) {
        throw new Error(e.message);
    }
  },

  async updateGroup(id, data) {
    try {
        const res = await client.mutate({
            mutation: UPDATE_GROUP,
            variables: { id, group: data }
        });
        return res.data.updateGroup;
    } catch (e) {
        throw new Error(e.message);
    }
  },

  async deleteGroup(id) {
    try {
        const res = await client.mutate({
            mutation: DELETE_GROUP,
            variables: { id }
        });
        if(!res.data.deleteGroup) throw new Error("Failed");
        return { success: true };
    } catch (e) {
        throw new Error(e.message);
    }
  },

  async getSections() {
    const res = await client.query({ query: GET_SECTIONS });
    const sectionsList = res.data.sections;
    const sectionsMap = {};
    sectionsList.forEach(s => {
        // eslint-disable-next-line no-unused-vars
        const { id, ...rest } = s;
        sectionsMap[s.id] = { id: s.id, ...rest };
    });
    return sectionsMap;
  },

  async createSection(id, data) {
    try {
        const res = await client.mutate({
            mutation: CREATE_SECTION,
            variables: { id, section: data }
        });
        return res.data.createSection;
    } catch (e) {
        throw new Error(e.message);
    }
  },

  async updateSection(id, data) {
    try {
        const res = await client.mutate({
            mutation: UPDATE_SECTION,
            variables: { id, section: data }
        });
        return res.data.updateSection;
    } catch (e) {
        throw new Error(e.message);
    }
  },

  async deleteSection(id) {
    try {
        const res = await client.mutate({
            mutation: DELETE_SECTION,
            variables: { id }
        });
        if(!res.data.deleteSection) throw new Error("Failed");
        return { success: true };
    } catch (e) {
        throw new Error(e.message);
    }
  },

  async createUser(user) {
    try {
        const res = await client.mutate({
            mutation: CREATE_USER,
            variables: { user }
        });
        return res.data.createUser;
    } catch (e) {
        throw new Error(e.message);
    }
  },

  async updateUser(id, data) {
    try {
        const res = await client.mutate({
            mutation: UPDATE_USER,
            variables: { id, user: data }
        });
        return res.data.updateUser;
    } catch (e) {
        throw new Error(e.message);
    }
  },

  async deleteUser(id) {
    try {
        const res = await client.mutate({
            mutation: DELETE_USER,
            variables: { id }
        });
        if(!res.data.deleteUser) throw new Error("Failed");
        return { success: true };
    } catch (e) {
        throw new Error(e.message);
    }
  },

  async getPages() {
    const res = await client.query({ query: GET_PAGES });
    return res.data.pages;
  },

  async getPage(slug) {
    const res = await client.query({ query: GET_PAGE, variables: { slug } });
    return res.data.page;
  },

  // eslint-disable-next-line no-unused-vars
  async savePage(slug, title, content, user, sectionId) {
    try {
        const res = await client.mutate({
            mutation: SAVE_PAGE,
            variables: { slug, title, content, sectionId }
        });
        return res.data.savePage;
    } catch (e) {
        throw new Error(e.message);
    }
  },

  // eslint-disable-next-line no-unused-vars
  async approveRevision(slug, index, user) {
     try {
        const res = await client.mutate({
            mutation: APPROVE_REVISION,
            variables: { slug, index }
        });
        return res.data.approveRevision;
     } catch (e) {
        throw new Error(e.message);
     }
  },

  // eslint-disable-next-line no-unused-vars
  async rejectRevision(slug, index, user) {
     try {
        const res = await client.mutate({
            mutation: REJECT_REVISION,
            variables: { slug, index }
        });
        return res.data.rejectRevision;
     } catch (e) {
        throw new Error(e.message);
     }
  },

  async getHistory(slug) {
    try {
        const res = await client.query({ query: GET_HISTORY, variables: { slug } });
        return res.data.history;
    } catch (e) {
        // eslint-disable-next-line no-unused-vars
        const unused = e;
        return [];
    }
  },

  // eslint-disable-next-line no-unused-vars
  async revert(slug, version, user) {
     try {
        const res = await client.mutate({
            mutation: REVERT_PAGE,
            variables: { slug, version }
        });
        return res.data.revertPage;
     } catch (e) {
        // eslint-disable-next-line no-unused-vars
        const unused = e;
        return null;
     }
  }
};
