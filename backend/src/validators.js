import mongoose from 'mongoose';
import { z } from 'zod';

// Id de archivo en GridFS: acepta null/undefined para "sin imagen".
export const objectId = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), 'Id inválido')
  .nullable()
  .optional();
