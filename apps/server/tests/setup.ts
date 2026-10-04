import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { resetDatabase } from './helpers/db.js';

// Every integration test starts from empty tables and builds its own data with the factories.
beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());
