import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export const hashPassword = (plain: string) => bcrypt.hash(plain, env.BCRYPT_ROUNDS);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

let dummyHash: Promise<string> | undefined;

/**
 * A hash with the same cost as real ones. Login compares against it when the
 * email is unknown, so response time does not reveal which emails exist.
 */
export const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing'));
