const emptyValue = (value: any) => {
  switch (typeof value) {
    case 'string':
      return value === '';
    case 'number':
      return value === 0;
    case 'object':
      return Object.keys(value).length === 0;
    case 'boolean':
      return !value;
    default:
      return value === null;
  }
};

export const percentComplete = (values: any[]) => {
  return (
    values
      .map((value: any) => (emptyValue(value) ? 0 : 1))
      .reduce((a: number, b: number) => a + b, 0) / values.length
  );
};
