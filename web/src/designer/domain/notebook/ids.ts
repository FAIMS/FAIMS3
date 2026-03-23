export const slugifyNotebookId = (value: string): string => {
  let result = value.trim();
  const from = 'ãàáäâáº½èéëêìíïîõòóöôùúüûñç·/_,:;';
  const to = 'aaaaaeeeeeiiiiooooouuuunc------';

  for (let i = 0; i < from.length; i += 1) {
    result = result.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  return result
    .replace(/[^A-Za-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

export const buildUniqueFieldName = (
  preferredName: string,
  existingFieldNames: string[]
): string => {
  const taken = new Set(existingFieldNames);
  let candidate = slugifyNotebookId(preferredName);
  let attempt = 1;

  while (taken.has(candidate)) {
    candidate = slugifyNotebookId(`${preferredName} ${attempt}`);
    attempt += 1;
  }

  return candidate;
};
