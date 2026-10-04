import { Role } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../../types/auth.js';
import { conflict, unauthorized } from '../../utils/AppError.js';
import { signToken } from '../../utils/jwt.js';
import { getDummyHash, hashPassword, verifyPassword } from '../../utils/password.js';
import { isUniqueViolation } from '../../utils/prismaErrors.js';
import * as usersRepository from '../users/users.repository.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);

  try {
    // Public sign-up always creates a MEMBER. The role is never read from the request.
    const user = await usersRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: Role.MEMBER,
    });
    return { token: signToken(user), user };
  } catch (err) {
    // Rely on the unique index instead of "find then insert", which has a race condition.
    if (isUniqueViolation(err)) {
      throw conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }
    throw err;
  }
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
