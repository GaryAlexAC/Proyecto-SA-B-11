import { SetMetadata } from '@nestjs/common';
import { CustomerRole } from '../generated/prisma/index.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: CustomerRole[]) => SetMetadata(ROLES_KEY, roles);
