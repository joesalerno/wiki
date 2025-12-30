import { dbController } from './db_controller.js';

// Helper to remove undefined keys
const cleanArgs = (args) => {
  return Object.fromEntries(
    Object.entries(args).filter(([, v]) => v !== undefined)
  );
};

export const resolvers = {
  Query: {
    users: async () => await dbController.getUsers(),
    groups: async () => {
      const groups = await dbController.getGroups();
      // groups is an object, convert to array for GraphQL
      return Object.entries(groups).map(([id, data]) => ({ id, ...data }));
    },
    sections: async () => {
      const sections = await dbController.getSections();
      return Object.values(sections);
    },
    pages: async (_, __, context) => {
      return await dbController.getPages({ id: context.userId });
    },
    page: async (_, { slug }, context) => {
      return await dbController.getPage(slug, { id: context.userId });
    },
    history: async (_, { slug }) => {
      return await dbController.getHistory(slug);
    }
  },
  Mutation: {
    createUser: async (_, { id, name, groups }, context) => {
      return await dbController.createUser({ id, name, groups }, { id: context.userId });
    },
    updateUser: async (_, args, context) => {
      const { id, ...data } = args;
      return await dbController.updateUser(id, cleanArgs(data), { id: context.userId });
    },
    deleteUser: async (_, { id }, context) => {
      await dbController.deleteUser(id, { id: context.userId });
      return { success: true };
    },

    createGroup: async (_, { id, permissions }, context) => {
      return await dbController.createGroup(id, { permissions }, { id: context.userId });
    },
    updateGroup: async (_, args, context) => {
      const { id, ...data } = args;
      return await dbController.updateGroup(id, cleanArgs(data), { id: context.userId });
    },
    deleteGroup: async (_, { id }, context) => {
      await dbController.deleteGroup(id, { id: context.userId });
      return { success: true };
    },

    createSection: async (_, args, context) => {
      const { id, ...data } = args;
      return await dbController.createSection(id, data, { id: context.userId });
    },
    updateSection: async (_, args, context) => {
        const { id, ...data } = args;
        return await dbController.updateSection(id, cleanArgs(data), { id: context.userId });
    },
    deleteSection: async (_, { id }, context) => {
      await dbController.deleteSection(id, { id: context.userId });
      return { success: true };
    },

    savePage: async (_, { slug, title, content, sectionId }, context) => {
      return await dbController.savePage(slug, title, content, { id: context.userId }, sectionId);
    },
    approveRevision: async (_, { slug, index }, context) => {
      return await dbController.approveRevision(slug, index, { id: context.userId });
    },
    rejectRevision: async (_, { slug, index }, context) => {
      return await dbController.rejectRevision(slug, index, { id: context.userId });
    },
    revertPage: async (_, { slug, version }, context) => {
      return await dbController.revert(slug, version, { id: context.userId });
    }
  }
};
