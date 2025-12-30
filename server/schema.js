export const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    groups: [String]!
  }

  type Group {
    id: ID!
    permissions: [String]!
  }

  type Section {
    id: ID!
    title: String!
    readGroups: [String]!
    writeGroups: [String]!
    reviewRequired: Boolean
    approverGroups: [String]
  }

  type Revision {
    version: Int!
    content: String!
    authorId: String!
    timestamp: Float!
    approvedBy: String
    approvedAt: Float
  }

  type PendingRevision {
    content: String!
    title: String!
    authorId: String!
    timestamp: Float!
    sectionId: String
  }

  type Page {
    id: ID
    slug: String!
    title: String!
    sectionId: String
    revisions: [Revision]
    pendingRevisions: [PendingRevision]
    status: String
    currentRevision: Revision
  }

  type PageListItem {
    slug: String!
    title: String!
    sectionId: String
    updatedAt: Float
    authorId: String
  }

  type Query {
    users: [User]
    groups: [Group]
    sections: [Section]
    pages: [PageListItem]
    page(slug: String!): Page
    history(slug: String!): [Revision]
  }

  type Mutation {
    createUser(id: ID!, name: String!, groups: [String]!): User
    updateUser(id: ID!, name: String, groups: [String]): User
    deleteUser(id: ID!): SuccessResponse

    createGroup(id: ID!, permissions: [String]!): Group
    updateGroup(id: ID!, permissions: [String]): Group
    deleteGroup(id: ID!): SuccessResponse

    createSection(id: ID!, title: String!, readGroups: [String]!, writeGroups: [String]!, reviewRequired: Boolean, approverGroups: [String]): Section
    updateSection(id: ID!, title: String, readGroups: [String], writeGroups: [String], reviewRequired: Boolean, approverGroups: [String]): Section
    deleteSection(id: ID!): SuccessResponse

    savePage(slug: String!, title: String!, content: String!, sectionId: String): Page
    approveRevision(slug: String!, index: Int!): Page
    rejectRevision(slug: String!, index: Int!): Page
    revertPage(slug: String!, version: Int!): Page
  }

  type SuccessResponse {
    success: Boolean!
  }
`;
