export const typeDefs = `#graphql
  type User {
    id: ID!
    name: String
    groups: [String]
  }

  type Group {
    id: ID!
    permissions: [String]
  }

  type Section {
    id: ID!
    title: String
    readGroups: [String]
    writeGroups: [String]
    reviewRequired: Boolean
    approverGroups: [String]
  }

  type Revision {
    version: Int
    content: String
    authorId: String
    timestamp: Float
    approvedBy: String
    approvedAt: Float
  }

  type PendingRevision {
    content: String
    title: String
    authorId: String
    timestamp: Float
    sectionId: String
  }

  type Page {
    id: ID
    slug: String
    title: String
    sectionId: String
    revisions: [Revision]
    pendingRevisions: [PendingRevision]
    currentRevision: Revision
    updatedAt: Float
    authorId: String
    status: String
  }

  input UserInput {
    id: ID
    name: String
    groups: [String]
  }

  input GroupInput {
    permissions: [String]
  }

  input SectionInput {
    title: String
    readGroups: [String]
    writeGroups: [String]
    reviewRequired: Boolean
    approverGroups: [String]
  }

  type Query {
    users: [User]
    groups: [Group]
    sections: [Section]
    pages: [Page]
    page(slug: String!): Page
    history(slug: String!): [Revision]
  }

  type Mutation {
    createUser(user: UserInput!): User
    updateUser(id: ID!, user: UserInput!): User
    deleteUser(id: ID!): Boolean

    createGroup(id: ID!, group: GroupInput!): Group
    updateGroup(id: ID!, group: GroupInput!): Group
    deleteGroup(id: ID!): Boolean

    createSection(id: ID!, section: SectionInput!): Section
    updateSection(id: ID!, section: SectionInput!): Section
    deleteSection(id: ID!): Boolean

    savePage(slug: String!, title: String!, content: String!, sectionId: String): Page
    approveRevision(slug: String!, index: Int!): Page
    rejectRevision(slug: String!, index: Int!): Page
    revertPage(slug: String!, version: Int!): Page
  }
`;
