import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'http://localhost:3001/graphql',
});

const authLink = setContext((_, { headers }) => {
  // get the authentication token from local storage if it exists
  const userId = localStorage.getItem('wiki_user_id');
  // return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      'X-User-ID': userId ? userId : "",
    }
  }
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache', // For this wiki app, simpler to fetch fresh data as we aren't using subscriptions and have shared state in backend
    },
    query: {
      fetchPolicy: 'no-cache',
    },
  },
});
