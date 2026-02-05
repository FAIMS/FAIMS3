import {ExpirySelector} from '@/components/expiry-selector';
import {Field, Form} from '@/components/form';
import {INVITE_TOKEN_HINTS} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {
  PostCreateInviteInput,
  Role,
  roleDetails,
  RoleScope,
} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {ErrorComponent} from '@tanstack/react-router';
import {useMemo, useState} from 'react';
import {z} from 'zod';

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
  const {user} = useAuth();
  const QueryClient = useQueryClient();
  const [selectedDateTime, setSelectedDateTime] = useState<string | undefined>(
    undefined
  );

  if (!user) {
    return <ErrorComponent error="Not authenticated" />;
  }

  // Memoize the role options to prevent re-computation on each render
  const roleOptions = useMemo(() => {
    if (!user) return [];
    return Object.entries(roleDetails)
      .filter(
        ([role, detail]) =>
          detail.scope === RoleScope.GLOBAL && role !== Role.GENERAL_ADMIN
      )
      .map(([value, {name: label}]) => ({
        label,
        value,
      }));
  }, [user]);

  const fields: Field[] = [
    {
      name: 'name',
      label: 'Invite title',
      schema: z.string().min(4),
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
      schema: z.number().min(1).optional(),
      type: 'number',
      min: 1,
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
    if (!user) return {type: 'submit', message: 'Not logged in'};

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

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/invites/global`,
      {
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
      }
    );

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
          hints={INVITE_TOKEN_HINTS}
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
