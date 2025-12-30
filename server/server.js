import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';

const app = express();
const PORT = 3001;

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

await server.start();

app.use(cors());
app.use(bodyParser.json());

// GraphQL endpoint
app.use(
  '/graphql',
  expressMiddleware(server, {
    context: async ({ req }) => {
      const userId = req.headers['x-user-id'];
      return { userId };
    },
  })
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
