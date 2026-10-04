import { z } from 'zod';

/** `/:id` route params. Validating the UUID up front keeps malformed ids away from the database. */
export const idParams = z.object({ id: z.uuid('Invalid id') });

export type IdParams = z.infer<typeof idParams>;
