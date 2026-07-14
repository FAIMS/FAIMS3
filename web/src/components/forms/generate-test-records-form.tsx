import {Field, Form} from '@/components/form';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {generateTestRecordsForProject} from '@/hooks/project-hooks';
import {AlertTriangle} from 'lucide-react';
import {toast} from 'sonner';
import {z} from 'zod';

interface GenerateTestRecordsFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  projectId: string;
}

/**
 * Developer-mode form to bulk-create random test records for a notebook.
 */
export function GenerateTestRecordsForm({
  setDialogOpen,
  projectId,
}: GenerateTestRecordsFormProps) {
  const user = useRequiredUser();

  const fields: Field[] = [
    {
      name: 'count',
      label: 'Number of records',
      description: 'Enter a value between 1 and 1000.',
      type: 'number',
      min: 1,
      max: 1000,
      schema: z
        .number({error: 'Enter a number of records'})
        .int()
        .min(1, 'At least 1 record is required')
        .max(1000, 'Maximum 1000 records per batch'),
    },
    {
      name: 'parallelism',
      label: 'Concurrency',
      description:
        'How many records to create at once (1–50). Higher values finish sooner but put more load on CouchDB; lower values are gentler on a local dev stack.',
      type: 'number',
      min: 1,
      max: 50,
      schema: z
        .number({error: 'Enter a concurrency value'})
        .int()
        .min(1, 'Concurrency must be at least 1')
        .max(50, 'Maximum concurrency is 50'),
    },
    {
      name: 'includeAttachments',
      label: 'Include attachments',
      description:
        'When enabled, photo and file fields are populated with a sample image. This is much slower for large batches.',
      type: 'checkbox',
      checkboxLabel: 'Populate photo and file fields with sample data',
      schema: z.boolean(),
    },
  ];

  const onSubmit = async ({
    count,
    parallelism,
    includeAttachments,
  }: {
    count: number;
    parallelism: number;
    includeAttachments: boolean;
  }) => {
    try {
      const result = await generateTestRecordsForProject({
        projectId,
        count,
        parallelism,
        includeAttachments,
        user,
      });

      toast.success(
        `Created ${result.record_ids.length} test record${result.record_ids.length === 1 ? '' : 's'}`
      );
      setDialogOpen(false);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to generate test records';
      toast.error(message);
      return {type: 'submit', message};
    }

    return undefined;
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert className="w-full">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>This may take a while</AlertTitle>
        <AlertDescription>
          Large batches and attachment generation can take several minutes. Keep
          this dialog open until generation completes.
        </AlertDescription>
      </Alert>
      <Form
        fields={fields}
        defaultValues={{
          count: 10,
          parallelism: 10,
          includeAttachments: false,
        }}
        onSubmit={onSubmit}
        submitButtonText="Generate records"
      />
    </div>
  );
}
