
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { dbController } from './db_controller.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    isAdmin: Boolean!
  }

  type Section {
    id: ID!
    title: String!
    readUsers: [ID!]!
    writeUsers: [ID!]!
    approverUsers: [ID!]!
    reviewRequired: Boolean!
  }

  type Revision {
    version: Int!
    content: String!
    authorId: ID!
    timestamp: Float!
    approvedBy: ID
    approvedAt: Float
  }

  type PendingRevision {
    content: String!
    title: String!
    authorId: ID!
    timestamp: Float!
    sectionId: ID
  }

  type Page {
    id: ID!
    slug: ID!
    title: String!
    sectionId: ID!
    revisions: [Revision!]!
    pendingRevisions: [PendingRevision!]
    currentRevision: Revision
    status: String
  }

  type PageSummary {
    slug: ID!
    title: String!
    sectionId: ID!
    updatedAt: Float
    authorId: ID
  }

  input SectionInput {
    title: String!
    readUsers: [ID!]!
    writeUsers: [ID!]!
    approverUsers: [ID!]!
    reviewRequired: Boolean!
  }

  type Query {
    users: [User!]!
    sections: [Section!]!
    pages(userId: ID): [PageSummary!]!
    page(slug: ID!, userId: ID): Page
    history(slug: ID!): [Revision!]!
  }

  type Mutation {
    createSection(id: ID!, input: SectionInput!, userId: ID): Section!
    updateSection(id: ID!, input: SectionInput!, userId: ID): Section!
    deleteSection(id: ID!, userId: ID): Boolean!
    savePage(slug: ID!, title: String!, content: String!, userId: ID!, sectionId: ID): Page!
    approveRevision(slug: ID!, index: Int!, userId: ID!): Page!
    rejectRevision(slug: ID!, index: Int!, userId: ID!): Page!
    revert(slug: ID!, version: Int!, userId: ID!): Page
  }
`;

const resolveUserId = (args, context) => args.userId || context.userId || null;

const resolvers = {
  Query: {
    users: () => dbController.getUsers(),
    sections: () => dbController.getSections(),
    pages: (_, args, context) => dbController.getPages(resolveUserId(args, context)),
    page: (_, args, context) => dbController.getPage(args.slug, resolveUserId(args, context)),
    history: (_, args) => dbController.getHistory(args.slug)
  },
  Mutation: {
    createSection: (_, args, context) => dbController.createSection(args.id, args.input, resolveUserId(args, context)),
    updateSection: (_, args, context) => dbController.updateSection(args.id, args.input, resolveUserId(args, context)),
    deleteSection: async (_, args, context) => {
      await dbController.deleteSection(args.id, resolveUserId(args, context));
      return true;
    },
    savePage: (_, args) => dbController.savePage(args.slug, args.title, args.content, args.userId, args.sectionId),
    approveRevision: (_, args) => dbController.approveRevision(args.slug, args.index, args.userId),
    rejectRevision: (_, args) => dbController.rejectRevision(args.slug, args.index, args.userId),
    revert: (_, args) => dbController.revert(args.slug, args.version, args.userId)
  }
};

const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

app.use('/graphql', expressMiddleware(server, {
  context: async ({ req }) => ({
    userId: req.headers['x-user-id']?.toString()
  })
}));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/graphql`);
});
