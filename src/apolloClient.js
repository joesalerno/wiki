import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'http://localhost:3001/',
});

const authLink = setContext((_, { headers }) => {
  // get the authentication token from local storage if it exists
  const userId = localStorage.getItem('wiki_user_id') || 'u3';
  // return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      'X-User-ID': userId,
    }
  }
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache', // Ensure fresh data for this wiki app nature
      errorPolicy: 'ignore',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  }
});
