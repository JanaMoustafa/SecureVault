import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create and export the MSW server for use in tests
export const server = setupServer(...handlers);
