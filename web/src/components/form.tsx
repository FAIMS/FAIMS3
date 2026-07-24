import {zodResolver} from '@hookform/resolvers/zod';
import {
  DefaultValues,
  ErrorOption,
  FieldValues,
  Path,
  Resolver,
  useForm,
} from 'react-hook-form';
import {z} from 'zod';
import {Button, ButtonProps} from '@/components/ui/button';
import {
  Form as FormProvider,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
  useFormField,
} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {Checkbox} from '@/components/ui/checkbox';
import {Label} from '@/components/ui/label';
import React, {useState} from 'react';
import {Alert, AlertTitle, AlertDescription} from './ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {Divider} from './ui/word-divider';
import {X} from 'lucide-react';

export interface Field {
  name: string;
  label?: string;
  description?: string;
  schema: z.ZodSchema;
  type?: string;
  options?: {label: string; value: string; description?: string}[];
  excludedBy?: string;
  excludedByFunction?: {
    field: string;
    checkFunction: (formValue: any) => boolean;
    explanation?: string;
  };
  min?: number | string;
  max?: number | string;
  step?: number;
  placeholder?: string;
  /** HTML `maxLength` for text inputs */
  maxLength?: number;
  /** Optional stable selector for e2e tests. */
  testId?: string;
  /** Inline label beside the control when `type` is `checkbox` (defaults to `label`) */
  checkboxLabel?: string;
  /** When true, optional select fields show a clear button to reset the value. */
  clearable?: boolean;
}

interface Divider {
  index: number;
  component: React.ReactNode;
}

/** Checkbox row wired to react-hook-form field id for accessible labelling. */
function CheckboxControlRow({
  checked,
  onCheckedChange,
  disabled,
  controlLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  controlLabel: string;
}) {
  const {formItemId} = useFormField();

  return (
    <div className="flex items-center gap-2 pt-1.5">
      <FormControl>
        <Checkbox
          checked={checked}
          onCheckedChange={value => onCheckedChange(value === true)}
          disabled={disabled}
        />
      </FormControl>
      <Label htmlFor={formItemId} className="font-normal cursor-pointer">
        {controlLabel}
      </Label>
    </div>
  );
}

/**
 * Form component renders a form with fields and a submit button.
 * It provides a way to handle form submission and validation.
 *
 * @param {FormProps} props - The properties object.
 * @param {Field[]} props.fields - An array of field objects.
 * @param {(data: TSchema) => Promise<ErrorOption | undefined>} props.onSubmit - A function to handle form submission.
 * @param {string} props.submitButtonText - The text to display on the submit button.
 * @param {DefaultValues<TSchema>} props.defaultValues - Default values for form fields.
 * @param {{disabled: boolean | ((data: TSchema) => boolean); reason: string}} props.disableSubmission - Optional object to disable form submission with a reason.
 * @returns {JSX.Element} The rendered Form component.
 */
export function Form<
  TFields extends Field[],
  TSchema extends FieldValues = {
    [F in TFields[number] as F['name']]: F['schema'];
  },
>({
  fields,
  dividers,
  onSubmit,
  submitButtonText = 'Submit',
  submitButtonVariant = 'default',
  submitButtonTestId,
  warningMessage,
  defaultValues,
  footer = undefined,
  disableSubmission,
}: {
  fields: TFields;
  dividers?: Divider[];
  onSubmit: (data: TSchema) => Promise<ErrorOption | undefined>;
  submitButtonText?: string;
  submitButtonVariant?: ButtonProps['variant'];
  submitButtonTestId?: string;
  warningMessage?: string;
  defaultValues?: DefaultValues<TSchema>;
  footer?: React.ReactNode;
  disableSubmission?: {
    disabled: boolean | ((data: TSchema) => boolean);
    reason: string;
  };
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Schema is built at runtime from Field[]; Zod v4 + resolvers v5 infer
  // Record<string, unknown> (and split input/output via preprocess), so cast
  // to the caller-facing TSchema used by useForm.
  const form = useForm<TSchema>({
    resolver: zodResolver(
      z.object(
        fields.reduce<z.ZodRawShape>((acc, field) => {
          // HTML number inputs emit strings; coerce before Zod validation.
          return {
            ...acc,
            [field.name]:
              field.type === 'number'
                ? z.preprocess(value => {
                    if (value === '' || value === undefined || value === null) {
                      return undefined;
                    }
                    if (typeof value === 'number') {
                      return value;
                    }
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? value : parsed;
                  }, field.schema)
                : field.schema,
          };
        }, {})
      )
    ) as Resolver<TSchema>,
    defaultValues,
  });

  const isSubmitDisabled =
    isSubmitting ||
    (disableSubmission
      ? typeof disableSubmission.disabled === 'function'
        ? disableSubmission.disabled(form.watch() as TSchema)
        : disableSubmission.disabled
      : false);

  const shouldShowDisableMessage =
    disableSubmission &&
    (typeof disableSubmission.disabled === 'function'
      ? disableSubmission.disabled(form.watch() as TSchema)
      : disableSubmission.disabled);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(async data => {
          form.clearErrors();
          setIsSubmitting(true);

          const errors = await onSubmit(data);
          if (errors) form.setError('root', errors);

          setIsSubmitting(false);
        })}
        className="flex min-w-0 flex-col gap-6"
      >
        <div className="flex flex-col gap-4">
          {fields.map(
            (
              {
                name,
                label,
                description,
                type,
                options,
                excludedBy,
                excludedByFunction,
                min,
                max,
                step,
                placeholder,
                maxLength,
                checkboxLabel,
                clearable,
                testId,
              },
              index
            ) => {
              const fieldName = name as Path<TSchema>;
              const isDisabled =
                (excludedBy !== undefined &&
                  form.watch(excludedBy as Path<TSchema>)) ||
                (excludedByFunction !== undefined &&
                  excludedByFunction.checkFunction(
                    form.watch(excludedByFunction.field as Path<TSchema>)
                  ));

              const showExclusionWarning =
                isDisabled && excludedByFunction?.explanation;

              return (
                <div key={name}>
                  {
                    dividers?.find(divider => divider.index === index)
                      ?.component
                  }
                  <FormField
                    control={form.control}
                    name={fieldName}
                    render={({field}) =>
                      type === 'checkbox' ? (
                        <FormItem>
                          {label && <FormLabel>{label}</FormLabel>}
                          {description && (
                            <FormDescription>{description}</FormDescription>
                          )}
                          <CheckboxControlRow
                            checked={field.value === true}
                            onCheckedChange={field.onChange}
                            disabled={isDisabled}
                            controlLabel={checkboxLabel ?? label ?? 'Enabled'}
                          />
                          {showExclusionWarning && (
                            <p className="text-sm text-amber-600 dark:text-amber-500 mt-1.5">
                              {excludedByFunction.explanation}
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      ) : (
                        <FormItem>
                          {label && <FormLabel>{label}</FormLabel>}
                          {description && (
                            <FormDescription>{description}</FormDescription>
                          )}
                          <FormControl>
                            {options ? (
                              <div className="flex w-full items-center gap-2">
                                <Select
                                  // Radix Select does not reliably return to an
                                  // empty state after clear; remount when cleared.
                                  key={
                                    clearable
                                      ? `${name}-${field.value ?? 'empty'}`
                                      : name
                                  }
                                  onValueChange={field.onChange}
                                  value={field.value || undefined}
                                  disabled={isDisabled}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue
                                      placeholder={
                                        placeholder ?? `Select ${label ?? name}`
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent className="max-w-md">
                                    {options.map(
                                      ({label, value, description}) => (
                                        <SelectItem
                                          key={value}
                                          value={value}
                                          description={description}
                                        >
                                          {label}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                                {clearable && field.value ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0"
                                    aria-label={`Clear ${label ?? name}`}
                                    disabled={isDisabled}
                                    onClick={() => field.onChange(undefined)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            ) : type === 'file' ? (
                              <Input
                                type="file"
                                min={min}
                                max={max}
                                step={step}
                                disabled={isDisabled}
                                className="cursor-pointer"
                                placeholder={placeholder}
                                data-testid={testId}
                                onChange={event =>
                                  event.target.files &&
                                  field.onChange(event.target.files[0])
                                }
                              />
                            ) : (
                              <Input
                                {...field}
                                type={type || 'text'}
                                min={
                                  type === 'number' || type === 'datetime-local'
                                    ? min
                                    : undefined
                                }
                                max={
                                  type === 'number' || type === 'datetime-local'
                                    ? max
                                    : undefined
                                }
                                maxLength={
                                  type !== 'number' &&
                                  type !== 'datetime-local' &&
                                  maxLength !== undefined
                                    ? maxLength
                                    : undefined
                                }
                                step={type === 'number' ? step : undefined}
                                disabled={isDisabled}
                                value={field.value ?? ''}
                                placeholder={placeholder}
                                data-testid={testId}
                                onChange={event =>
                                  type === 'number'
                                    ? field.onChange(
                                        event.target.value === ''
                                          ? undefined
                                          : Number(event.target.value)
                                      )
                                    : field.onChange(event)
                                }
                              />
                            )}
                          </FormControl>
                          {showExclusionWarning && (
                            <p className="text-sm text-amber-600 dark:text-amber-500 mt-1.5">
                              {excludedByFunction.explanation}
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )
                    }
                  />
                </div>
              );
            }
          )}
        </div>
        {footer ?? null}
        {warningMessage && (
          <Alert variant="destructive">
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>{warningMessage}</AlertDescription>
          </Alert>
        )}
        <FormMessage>{form.formState.errors.root?.message}</FormMessage>
        {shouldShowDisableMessage && (
          <p className="min-w-0 max-w-full break-words text-sm text-destructive">
            {disableSubmission.reason}
          </p>
        )}
        <Button
          type="submit"
          variant={submitButtonVariant}
          className="w-full"
          disabled={isSubmitDisabled}
          data-testid={submitButtonTestId}
        >
          {submitButtonText}
        </Button>
      </form>
    </FormProvider>
  );
}
