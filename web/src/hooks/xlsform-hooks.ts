import {User} from '@/context/auth-provider';
import {config} from '@/constants';
import {fileToBase64} from '@/lib/input-limits';

/**
 * Converts an uploaded XLSForm (.xlsx) file into a Fieldmark
 * uiSpecification via POST /api/convert-xlsform. Returns only
 * the uiSpec and any skipped question types -- no template/project
 * metadata -- so the caller can pass the result into the existing
 * template or project create/update endpoints.
 */
export const convertXlsformToUiSpecification = async ({
  user,
  file,
}: {
  user: User;
  file: File;
}) => {
  const fileBase64 = await fileToBase64(file);
  if (!fileBase64) {
    return {ok: false as const, message: 'Error reading file'};
  }
  const res = await fetch(`${config.apiUrl}/api/convert-xlsform`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({fileBase64}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    return {
      ok: false as const,
      message: body?.error?.message ?? 'Conversion failed',
    };
  }
  const {uiSpecification, skipped} = await res.json();
  return {ok: true as const, uiSpecification, skipped};
};
