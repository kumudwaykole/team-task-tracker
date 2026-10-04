import { Role } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/auth.js';
import { unauthorized } from '../../utils/AppError.js';
import { signToken } from '../../utils/jwt.js';
import { getDummyHash, verifyPassword } from '../../utils/password.js';
import * as usersRepository from '../users/users.repository.js';
import { createUser } from '../users/users.service.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

interface AuthResult {
  token: string;
  user: AuthUser;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  // Public sign-up always creates a MEMBER. The role is never read from the request.
  const user = await createUser({ ...input, role: Role.MEMBER });
  return { token: signToken(user), user };
}

export async function login({ email, password }: LoginInput): Promise<AuthResult> {
  const record = await usersRepository.findByEmailWithPassword(email);

  // Always run bcrypt, even for unknown emails, so response time does not reveal which emails exist.
  const passwordMatches = await verifyPassword(
    password,
    record?.passwordHash ?? (await getDummyHash()),
  );

  // Same error for "no such user" and "wrong password".
  if (!record || !passwordMatches) {
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const user: AuthUser = {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
  };
  return { token: signToken(user), user };
}
