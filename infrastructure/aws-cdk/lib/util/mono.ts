/*
 * Created Date: Friday July 26th 2024 Author: Peter Baker
 * -----
 * Last Modified: Friday July 26th 2024 10:25:17 am Modified By: Peter Baker
 * -----
 * Description: Utility functions for managing connection to the monorepo and
 * other concerns.
 * -----
 * HISTORY: Date         By  Comments
 * ----------   --- ---------------------------------------------------------
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * This function returns the path to the monorepo root. Useful for bundling assets from the monorepo.
 * @returns The path to the monorepo root.
 */
export const getPathToRoot = (): string => {
  return '../..';
};

/**
 * Traverses a directory / path and returns hash which will change if any file in the directory changes.
 * @param pathToHash The path to hash
 * @param excludeDirs An optional array of directory names to exclude from hashing
 * @returns A suitable hash for asset hashing for given directory/file
 */
export const getPathHash = (
  pathToHash: string,
  excludeDirs: string[] = []
): string => {
  const hash = crypto.createHash('sha256');

  const processFile = (filePath: string) => {
    const content = fs.readFileSync(filePath);
    hash.update(filePath);
    hash.update(content);
  };

  const processDirectory = (dirPath: string) => {
    const entries = fs.readdirSync(dirPath, {withFileTypes: true});

    // Sort entries to ensure consistent ordering
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // Check if the directory should be excluded
        if (!excludeDirs.includes(entry.name)) {
          processDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        processFile(fullPath);
      }
    }
  };

  if (fs.statSync(pathToHash).isDirectory()) {
    processDirectory(pathToHash);
  } else {
    processFile(pathToHash);
  }

  return hash.digest('hex');
};
