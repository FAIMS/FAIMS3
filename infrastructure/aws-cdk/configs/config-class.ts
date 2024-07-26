import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Define the schema
const ConfigSchema = z.object({
  hostedZone: z.object({
    id: z.string(),
    name: z.string(),
  }),
  certificates: z.object({
    primary: z.string(),
    cloudfront: z.string(),
  }),
  aws: z.object({
    account: z.string(),
    region: z.string().default('ap-southeast-2'),
  }),
  secrets: z.object({
    privateKey: z.string(),
    publicKey: z.string(),
  }),
});

// Infer the type from the schema
export type Config = z.infer<typeof ConfigSchema>;

export const loadConfig = (filePath: string): Config => {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const fileContents = fs.readFileSync(absolutePath, 'utf-8');
  const jsonData = JSON.parse(fileContents);

  // Parse and validate the config
  return ConfigSchema.parse(jsonData);
}