
import express from 'express';
import cors from 'cors';
import { Buffer } from 'node:buffer';
import fs from 'fs/promises';
import path from 'path';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { fileURLToPath } from 'url';
import { wikiDataController } from './wikiDataController.js';

const app = express();
const PORT = 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

function sanitizeFileName(fileName) {
  const trimmedName = (fileName || 'upload').trim();
  const ext = path.extname(trimmedName);
  const baseName = path.basename(trimmedName, ext);
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'upload';
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();
  return `${safeBaseName}${safeExt}`;
}

function buildAssetUrl(req, fileName) {
  if (!req) return `/uploads/${encodeURIComponent(fileName)}`;
  return `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(fileName)}`;
}

const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
  }

  type Group {
    name: String!
    users: [User!]!
  }

  type WikiSection {
    title: String!
    readGroups: [String!]!
    writeGroups: [String!]!
    approverGroups: [String!]!
    reviewRequired: Boolean!
  }

  type WikiRevision {
    version: Int!
    content: String!
    authorId: ID!
    timestamp: Float!
    approvedBy: ID
    approvedAt: Float
  }

  type WikiPendingRevision {
    content: String!
    title: String!
    authorId: ID!
    timestamp: Float!
    sectionId: ID
  }

  type WikiPage {
    title: String!
    sectionId: ID!
    reviewMode: String!
    revisions: [WikiRevision!]!
    pendingRevisions: [WikiPendingRevision!]
    currentRevision: WikiRevision
    status: String
  }

  type WikiPageSummary {
    title: String!
    sectionId: ID!
    reviewMode: String!
    pendingReviewCount: Int!
    updatedAt: Float
    authorId: ID
    approvedAt: Float
    approvedBy: ID
  }

  input WikiSectionInput {
    title: String!
    readGroups: [String!]!
    writeGroups: [String!]!
    approverGroups: [String!]!
    reviewRequired: Boolean!
  }

  type AssetUploadResult {
    fileName: String!
    mimeType: String!
    isImage: Boolean!
    url: String!
    markdown: String!
  }

  type Query {
    users: [User!]!
    groups: [Group!]!
    wikiSections: [WikiSection!]!
    wikiPages(userId: ID): [WikiPageSummary!]!
    wikiPage(title: ID!, userId: ID): WikiPage
    wikiPageHistory(title: ID!): [WikiRevision!]!
  }

  type Mutation {
    uploadAsset(fileName: String!, contentBase64: String!, mimeType: String!): AssetUploadResult!
    createGroup(name: String!, userId: ID): Group!
    updateGroup(name: String!, memberIds: [ID!]!, userId: ID): Group!
    deleteGroup(name: String!, userId: ID): Boolean!
    createWikiGroup(name: String!, userId: ID): Group!
    updateWikiGroup(name: String!, memberIds: [ID!]!, userId: ID): Group!
    deleteWikiGroup(name: String!, userId: ID): Boolean!
    createWikiSection(input: WikiSectionInput!, userId: ID): WikiSection!
    updateWikiSection(title: String!, input: WikiSectionInput!, userId: ID): WikiSection!
    deleteWikiSection(title: String!, userId: ID): Boolean!
    updateWikiPageReviewMode(title: ID!, reviewMode: String!, userId: ID): WikiPage!
    saveWikiPage(title: String!, content: String!, userId: ID!, sectionId: ID, originalTitle: String): WikiPage!
    approveWikiRevision(title: ID!, index: Int!, userId: ID!): WikiPage!
    rejectWikiRevision(title: ID!, index: Int!, userId: ID!): WikiPage!
    revertWikiPage(title: ID!, version: Int!, userId: ID!): WikiPage
  }
`;

const resolveUserId = (args, context) => args.userId || context.userId || null;

const resolvers = {
  Group: {
    users: async (group) => {
      const users = await Promise.all((group.memberIds || []).map(userId => wikiDataController.getUserById(userId)));
      return users.filter(Boolean);
    }
  },
  Query: {
    users: () => wikiDataController.getUsers(),
    groups: () => wikiDataController.getGroups(),
    wikiSections: () => wikiDataController.getWikiSections(),
    wikiPages: (_, args, context) => wikiDataController.getWikiPages(resolveUserId(args, context)),
    wikiPage: (_, args, context) => wikiDataController.getWikiPage(args.title, resolveUserId(args, context)),
    wikiPageHistory: (_, args) => wikiDataController.getWikiPageHistory(args.title)
  },
  Mutation: {
    uploadAsset: async (_, { fileName, contentBase64, mimeType }, context) => {
      if (!fileName || !contentBase64 || !mimeType) {
        throw new Error('fileName, contentBase64, and mimeType are required');
      }

      const buffer = Buffer.from(contentBase64, 'base64');
      if (!buffer.length) {
        throw new Error('Uploaded file is empty');
      }

      if (buffer.length > MAX_UPLOAD_BYTES) {
        throw new Error('File too large. Maximum size is 10 MB.');
      }

      await fs.mkdir(UPLOAD_DIR, { recursive: true });

      const safeFileName = sanitizeFileName(fileName);
      const stampedFileName = `${Date.now()}-${safeFileName}`;
      const filePath = path.join(UPLOAD_DIR, stampedFileName);

      await fs.writeFile(filePath, buffer);

      const url = buildAssetUrl(context.req, stampedFileName);
      const isImage = mimeType.startsWith('image/');

      return {
        fileName: stampedFileName,
        mimeType,
        isImage,
        url,
        markdown: isImage ? `![${safeFileName}](${url})` : `[${safeFileName}](${url})`
      };
    },
    createGroup: (_, args, context) => wikiDataController.createGroup(args.name, resolveUserId(args, context)),
    updateGroup: (_, args, context) => wikiDataController.updateGroup(args.name, args.memberIds, resolveUserId(args, context)),
    deleteGroup: async (_, args, context) => {
      await wikiDataController.deleteGroup(args.name, resolveUserId(args, context));
      return true;
    },
    createWikiGroup: (_, args, context) => wikiDataController.createWikiGroup(args.name, resolveUserId(args, context)),
    updateWikiGroup: (_, args, context) => wikiDataController.updateWikiGroup(args.name, args.memberIds, resolveUserId(args, context)),
    deleteWikiGroup: async (_, args, context) => {
      await wikiDataController.deleteWikiGroup(args.name, resolveUserId(args, context));
      return true;
    },
    createWikiSection: (_, args, context) => wikiDataController.createWikiSection(args.input?.title, args.input, resolveUserId(args, context)),
    updateWikiSection: (_, args, context) => wikiDataController.updateWikiSection(args.title, args.input, resolveUserId(args, context)),
    deleteWikiSection: async (_, args, context) => {
      await wikiDataController.deleteWikiSection(args.title, resolveUserId(args, context));
      return true;
    },
    updateWikiPageReviewMode: (_, args, context) => wikiDataController.updateWikiPageReviewMode(args.title, args.reviewMode, resolveUserId(args, context)),
    saveWikiPage: (_, args) => wikiDataController.saveWikiPage(args.title, args.content, args.userId, args.sectionId, args.originalTitle),
    approveWikiRevision: (_, args) => wikiDataController.approveWikiRevision(args.title, args.index, args.userId),
    rejectWikiRevision: (_, args) => wikiDataController.rejectWikiRevision(args.title, args.index, args.userId),
    revertWikiPage: (_, args) => wikiDataController.revertWikiPage(args.title, args.version, args.userId)
  }
};

const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

app.use('/graphql', expressMiddleware(server, {
  context: async ({ req }) => ({
    userId: req.headers['x-user-id']?.toString(),
    req
  })
}));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/graphql`);
});
