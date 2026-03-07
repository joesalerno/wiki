
import express from 'express';
import cors from 'cors';
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
  return `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(fileName)}`;
}

app.post('/wiki-assets', async (req, res) => {
  try {
    const { fileName, contentBase64, mimeType } = req.body || {};

    if (!fileName || !contentBase64 || !mimeType) {
      return res.status(400).json({ error: 'fileName, contentBase64, and mimeType are required' });
    }

    const buffer = Buffer.from(contentBase64, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'File too large. Maximum size is 10 MB.' });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const safeFileName = sanitizeFileName(fileName);
    const stampedFileName = `${Date.now()}-${safeFileName}`;
    const filePath = path.join(UPLOAD_DIR, stampedFileName);

    await fs.writeFile(filePath, buffer);

    const url = buildAssetUrl(req, stampedFileName);
    const isImage = mimeType.startsWith('image/');

    return res.status(201).json({
      fileName: stampedFileName,
      mimeType,
      isImage,
      url,
      markdown: isImage ? `![${safeFileName}](${url})` : `[${safeFileName}](${url})`
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to upload asset' });
  }
});

const typeDefs = `#graphql
  type WikiUser {
    id: ID!
    name: String!
    isAdmin: Boolean!
  }

  type WikiSection {
    title: String!
    readUsers: [ID!]!
    writeUsers: [ID!]!
    approverUsers: [ID!]!
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
    revisions: [WikiRevision!]!
    pendingRevisions: [WikiPendingRevision!]
    currentRevision: WikiRevision
    status: String
  }

  type WikiPageSummary {
    title: String!
    sectionId: ID!
    updatedAt: Float
    authorId: ID
  }

  input WikiSectionInput {
    title: String!
    readUsers: [ID!]!
    writeUsers: [ID!]!
    approverUsers: [ID!]!
    reviewRequired: Boolean!
  }

  type Query {
    wikiUsers: [WikiUser!]!
    wikiSections: [WikiSection!]!
    wikiPages(userId: ID): [WikiPageSummary!]!
    wikiPage(title: ID!, userId: ID): WikiPage
    wikiPageHistory(title: ID!): [WikiRevision!]!
  }

  type Mutation {
    createWikiSection(input: WikiSectionInput!, userId: ID): WikiSection!
    updateWikiSection(title: String!, input: WikiSectionInput!, userId: ID): WikiSection!
    deleteWikiSection(title: String!, userId: ID): Boolean!
    saveWikiPage(title: String!, content: String!, userId: ID!, sectionId: ID): WikiPage!
    approveWikiRevision(title: ID!, index: Int!, userId: ID!): WikiPage!
    rejectWikiRevision(title: ID!, index: Int!, userId: ID!): WikiPage!
    revertWikiPage(title: ID!, version: Int!, userId: ID!): WikiPage
  }
`;

const resolveUserId = (args, context) => args.userId || context.userId || null;

const resolvers = {
  Query: {
    wikiUsers: () => wikiDataController.getWikiUsers(),
    wikiSections: () => wikiDataController.getWikiSections(),
    wikiPages: (_, args, context) => wikiDataController.getWikiPages(resolveUserId(args, context)),
    wikiPage: (_, args, context) => wikiDataController.getWikiPage(args.title, resolveUserId(args, context)),
    wikiPageHistory: (_, args) => wikiDataController.getWikiPageHistory(args.title)
  },
  Mutation: {
    createWikiSection: (_, args, context) => wikiDataController.createWikiSection(args.input?.title, args.input, resolveUserId(args, context)),
    updateWikiSection: (_, args, context) => wikiDataController.updateWikiSection(args.title, args.input, resolveUserId(args, context)),
    deleteWikiSection: async (_, args, context) => {
      await wikiDataController.deleteWikiSection(args.title, resolveUserId(args, context));
      return true;
    },
    saveWikiPage: (_, args) => wikiDataController.saveWikiPage(args.title, args.content, args.userId, args.sectionId),
    approveWikiRevision: (_, args) => wikiDataController.approveWikiRevision(args.title, args.index, args.userId),
    rejectWikiRevision: (_, args) => wikiDataController.rejectWikiRevision(args.title, args.index, args.userId),
    revertWikiPage: (_, args) => wikiDataController.revertWikiPage(args.title, args.version, args.userId)
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
