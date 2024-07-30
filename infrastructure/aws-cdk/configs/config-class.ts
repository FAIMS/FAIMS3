import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Define the schema for the backup configuration
const BackupConfigSchema = z
  .object({
    vaultName: z.string().optional(),
    vaultArn: z.string().optional(),
    retentionDays: z.number().int().min(1).default(30),
    scheduleExpression: z.string().default("cron(0 3 * * ? *)"),
  })
  .refine(
    (data) => (data.vaultName !== undefined) !== (data.vaultArn !== undefined),
    {
      message: "Either vaultName or vaultArn must be provided, but not both",
    }
  );

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
    region: z.string().default("ap-southeast-2"),
  }),
  secrets: z.object({
    privateKey: z.string(),
    publicKey: z.string(),
  }),
  backup: BackupConfigSchema,
});

// Infer the type from the schema
export type Config = z.infer<typeof ConfigSchema>;

export const loadConfig = (filePath: string): Config => {
  // Parse and validate the config
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const fileContents = fs.readFileSync(absolutePath, "utf-8");
    const jsonData = JSON.parse(fileContents);
    return ConfigSchema.parse(jsonData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Configuration validation failed:");
      error.errors.forEach((err) => {
        console.error(`- ${err.path.join(".")}: ${err.message}`);
      });
    } else {
      console.error("Error loading configuration:", error);
    }
  }
  process.exit(1);
};
