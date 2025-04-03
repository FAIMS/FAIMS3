import {zodResolver} from '@hookform/resolvers/zod';
import {
  DefaultValues,
  ErrorOption,
  FieldValues,
  Path,
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
} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {useState} from 'react';
import {Alert, AlertTitle, AlertDescription} from './ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {Divider} from './ui/word-divider';

export interface Field {
  name: string;
  label?: string;
  description?: string;
  schema: z.ZodSchema;
  type?: string;
  options?: {label: string; value: string}[];
  excludes?: string;
}

interface Divider {
  index: number;
  component: React.ReactNode;
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
  warningMessage,
  defaultValues,
}: {
  fields: TFields;
  dividers?: Divider[];
  onSubmit: (data: TSchema) => Promise<ErrorOption | undefined>;
  submitButtonText?: string;
  submitButtonVariant?: ButtonProps['variant'];
  warningMessage?: string;
  defaultValues?: DefaultValues<TSchema>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TSchema>({
    resolver: zodResolver(
      z.object(
        fields.reduce((acc, {name, schema}) => {
          acc[name] = schema;
          return acc;
        }, {} as z.ZodRawShape)
      )
    ),
    defaultValues,
  });

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
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-2">
          {fields.map(({name, label, type, options, excludes}, index) => {
            const fieldName = name as Path<TSchema>;
            return (
              <div key={name}>
                {dividers?.find(divider => divider.index === index)?.component}
                <FormField
                  control={form.control}
                  name={fieldName}
                  render={({field}) => (
                    <FormItem>
                      {label && <FormLabel>{label}</FormLabel>}
                      <FormControl>
                        {options ? (
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={
                              excludes !== undefined &&
                              form.watch(excludes as Path<TSchema>)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${name}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map(({label, value}) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            {...field}
                            type={type}
                            disabled={
                              excludes !== undefined &&
                              form.watch(excludes as Path<TSchema>)
                            }
                            className={type === 'file' ? 'cursor-pointer' : ''}
                            value={type === 'file' ? undefined : field.value}
                            onChange={event =>
                              type === 'file'
                                ? event.target.files &&
                                  field.onChange(event.target.files[0])
                                : field.onChange(event)
                            }
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            );
          })}
        </div>
        {warningMessage && (
          <Alert variant="destructive">
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>{warningMessage}</AlertDescription>
          </Alert>
        )}
        <FormMessage>{form.formState.errors.root?.message}</FormMessage>
        <Button
          type="submit"
          variant={submitButtonVariant}
          className="w-full"
          disabled={isSubmitting}
        >
          {submitButtonText}
        </Button>
      </form>
    </FormProvider>
  );
}
