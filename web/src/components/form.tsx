import {zodResolver} from '@hookform/resolvers/zod';
import {ErrorOption, FieldValues, Path, useForm} from 'react-hook-form';
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
import {DialogClose} from '@radix-ui/react-dialog';

interface Field {
  name: string;
  label?: string;
  schema: z.ZodSchema;
  type?: string;
}

/**
 * Form component renders a form with fields and a submit button.
 * It provides a way to handle form submission and validation.
 *
 * @param {FormProps} props - The properties object.
 * @param {Field[]} props.fields - An array of field objects.
 * @param {(data: TSchema) => Promise<ErrorOption | undefined>} props.onSubmit - A function to handle form submission.
 * @param {string} props.submitButtonText - The text to display on the submit button.
 * @returns {JSX.Element} The rendered Form component.
 */
export function Form<
  TFields extends Field[],
  TSchema extends FieldValues = {
    [F in TFields[number] as F['name']]: F['schema'];
  },
>({
  fields,
  onSubmit,
  submitButtonText = 'Submit',
  submitButtonVariant = 'default',
  warningMessage,
}: {
  fields: TFields;
  onSubmit: (data: TSchema) => Promise<ErrorOption | undefined>;
  submitButtonText?: string;
  submitButtonVariant?: ButtonProps['variant'];
  warningMessage?: string;
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
          {fields.map(({name, label, type}) => (
            <FormField
              key={name}
              control={form.control}
              name={name as Path<TSchema>}
              render={({field: {value, onChange, ...field}}) => (
                <FormItem>
                  {label && <FormLabel>{label}</FormLabel>}
                  <FormControl>
                    <Input
                      {...field}
                      type={type}
                      onChange={event =>
                        type === 'file'
                          ? event.target.files &&
                            onChange(event.target.files[0])
                          : onChange(event)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
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
