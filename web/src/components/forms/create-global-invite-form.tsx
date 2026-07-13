import {ExpirySelector} from '@/components/expiry-selector';
import {Field, Form} from '@/components/form';
import {config} from '@/constants';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {
  INPUT_LIMITS,
  PostCreateInviteInput,
  Role,
  roleDetails,
  RoleScope,
} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {z} from 'zod';

// Global-scope roles offered by the invite form; static because roleDetails is
// a module-level constant
const roleOptions = Object.entries(roleDetails)
  .filter(
    ([role, detail]) =>
      detail.scope === RoleScope.GLOBAL && role !== Role.GENERAL_ADMIN
  )
  .map(([value, {name: label, description}]) => ({
    label,
    value,
    description,
  }));

/**
 * Form to create a new global invite
 *
 * @param props - The props for the form
 * @returns {JSX.Element} The rendered form
 */
export function CreateGlobalInviteForm({
  setDialogOpen,
}: {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const user = useRequiredUser();
  const QueryClient = useQueryClient();
  const [selectedDateTime, setSelectedDateTime] = useState<string | undefined>(
    undefined
  );

  const fields: Field[] = [
    {
      name: 'name',
      label: 'Invite title',
      schema: z
        .string()
        .min(4)
        .max(INPUT_LIMITS.INVITE_NAME_MAX_LENGTH, {
          message: `Invite title must be at most ${INPUT_LIMITS.INVITE_NAME_MAX_LENGTH} characters`,
        }),
      maxLength: INPUT_LIMITS.INVITE_NAME_MAX_LENGTH,
    },
    {
      name: 'role',
      label: 'Role',
      options: roleOptions,
      schema: z.nativeEnum(Role),
    },
    {
      name: 'uses',
      label: 'Maximum uses (leave empty to set no limit)',
      schema: z
        .number()
        .int()
        .min(1)
        .max(INPUT_LIMITS.INVITE_MAX_USES)
        .optional(),
      type: 'number',
      min: 1,
      max: INPUT_LIMITS.INVITE_MAX_USES,
    },
  ];

  /**
   * Handles the form submission
   *
   * @returns {Promise<void>} A promise that resolves when the invite is created
   */
  const onSubmit = async ({
    role,
    uses,
    name,
  }: {
    role: string;
    uses?: number;
    name: string;
  }) => {
    // Validate expiry selection
    if (!selectedDateTime) {
      return {type: 'submit', message: 'Please select an expiry date'};
    }

    // Get expiry timestamp
    let expiryTimestampMs: number | undefined = undefined;

    if (selectedDateTime === 'never') {
      // Never expires - we'll pass undefined
      expiryTimestampMs = undefined;
    } else {
      const expiryDate = new Date(selectedDateTime);
      expiryTimestampMs = expiryDate.getTime();

      if (isNaN(expiryTimestampMs)) {
        return {type: 'submit', message: 'Invalid expiry date'};
      }
    }

    const response = await fetch(`${config.apiUrl}/api/invites/global`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        name,
        role: role as Role,
        uses,
        expiry: expiryTimestampMs,
      } satisfies PostCreateInviteInput),
    });

    if (!response.ok)
      return {type: 'submit', message: 'Error creating invite.'};

    QueryClient.invalidateQueries({queryKey: ['globalinvites']});
    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={'Create Invite'}
      footer={
        <ExpirySelector
          hints={config.inviteTokenHints}
          maxDurationDays={365}
          maximumDurationPrefix="Maximum invite duration"
          selectedDateTime={selectedDateTime}
          setSelectedDateTime={setSelectedDateTime}
          title="Invite Duration"
          subtitle="Choose how long this invite should remain valid"
        />
      }
    />
  );
}
