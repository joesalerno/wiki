import { dbController } from './db_controller.js';

export const resolvers = {
  Query: {
    users: async () => await dbController.getUsers(),
    groups: async () => {
      const groupsMap = await dbController.getGroups();
      return Object.entries(groupsMap).map(([id, data]) => ({ id, ...data }));
    },
    sections: async () => {
      const sectionsMap = await dbController.getSections();
      return Object.values(sectionsMap);
    },
    pages: async (_, __, context) => {
      const user = context.userId ? { id: context.userId } : null;
      return await dbController.getPages(user);
    },
    page: async (_, { slug }, context) => {
      const user = context.userId ? { id: context.userId } : null;
      try {
        return await dbController.getPage(slug, user);
      } catch (e) {
        if (e.message === 'Permission denied') return null;
        throw e;
      }
    },
    history: async (_, { slug }) => {
      return await dbController.getHistory(slug);
    }
  },
  Mutation: {
    createUser: async (_, { user }, context) => {
      const requestor = { id: context.userId };
      return await dbController.createUser(user, requestor);
    },
    updateUser: async (_, { id, user }, context) => {
      const requestor = { id: context.userId };
      return await dbController.updateUser(id, user, requestor);
    },
    deleteUser: async (_, { id }, context) => {
      const requestor = { id: context.userId };
      const res = await dbController.deleteUser(id, requestor);
      return res.success;
    },
    createGroup: async (_, { id, group }, context) => {
      const requestor = { id: context.userId };
      return await dbController.createGroup(id, group, requestor);
    },
    updateGroup: async (_, { id, group }, context) => {
      const requestor = { id: context.userId };
      return await dbController.updateGroup(id, group, requestor);
    },
    deleteGroup: async (_, { id }, context) => {
      const requestor = { id: context.userId };
      const res = await dbController.deleteGroup(id, requestor);
      return res.success;
    },
    createSection: async (_, { id, section }, context) => {
      const requestor = { id: context.userId };
      return await dbController.createSection(id, section, requestor);
    },
    updateSection: async (_, { id, section }, context) => {
      const requestor = { id: context.userId };
      return await dbController.updateSection(id, section, requestor);
    },
    deleteSection: async (_, { id }, context) => {
      const requestor = { id: context.userId };
      const res = await dbController.deleteSection(id, requestor);
      return res.success;
    },
    savePage: async (_, { slug, title, content, sectionId }, context) => {
      const user = { id: context.userId };
      return await dbController.savePage(slug, title, content, user, sectionId);
    },
    approveRevision: async (_, { slug, index }, context) => {
      const user = { id: context.userId };
      return await dbController.approveRevision(slug, index, user);
    },
    rejectRevision: async (_, { slug, index }, context) => {
      const user = { id: context.userId };
      return await dbController.rejectRevision(slug, index, user);
    },
    revertPage: async (_, { slug, version }, context) => {
      const user = { id: context.userId };
      return await dbController.revert(slug, version, user);
    }
  }
};
