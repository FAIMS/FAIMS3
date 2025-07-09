/* eslint-disable n/no-process-exit */

import {restoreFromBackup} from '../couchdb/backupRestore';

interface ParsedArgs {
  filename?: string;
  pattern?: string;
  force: boolean;
  help: boolean;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const parsed: ParsedArgs = {
    force: false,
    help: false
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--force' || arg === '-f') {
      parsed.force = true;
    } else if (arg === '--pattern' || arg === '-p') {
      if (i + 1 < args.length) {
        parsed.pattern = args[i + 1];
        i++; // Skip next argument as it's the pattern value
      } else {
        throw new Error('--pattern requires a value');
      }
    } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
      // Assume it's the filename if no filename is set yet
      if (!parsed.filename) {
        parsed.filename = arg;
      } else {
        throw new Error(`Unexpected argument: ${arg}`);
      }
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
};

const showHelp = () => {
  console.log('Usage: node restoreBackup.ts [options] <filename>');
  console.log('');
  console.log('Options:');
  console.log(
    '  -p, --pattern <pattern>  Regex pattern to filter databases to restore'
  );
  console.log(
    '  -f, --force             Force overwrite of existing documents'
  );
  console.log('  -h, --help              Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node restoreBackup.ts backup.jsonl');
  console.log('  node restoreBackup.ts --pattern "Foo.*" backup.jsonl');
  console.log('  node restoreBackup.ts --pattern "Foo.*" --force backup.jsonl');
};

const main = async () => {
  try {
    const args = parseArgs(process.argv);

    if (args.help) {
      showHelp();
      process.exit(0);
    }

    if (!args.filename) {
      console.error('Error: Missing required filename argument');
      console.log('');
      showHelp();
      process.exit(1);
    }

    console.log(`Restoring from ${args.filename}`);
    if (args.pattern) {
      console.log(`Using pattern: ${args.pattern}`);
    }
    if (args.force) {
      console.log('Force overwrite enabled');
    }

    await restoreFromBackup({
      filename: args.filename,
      pattern: args.pattern,
      force: args.force,
    });

    console.log('Backup restore completed successfully.');
    process.exit(0);
  } catch (err) {
    if (err instanceof Error) {
      console.error('Error:', err.message);
    } else {
      console.error('Error restoring backup:', err);
    }
    process.exit(1);
  }
};

main();
