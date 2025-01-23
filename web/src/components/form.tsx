import {zodResolver} from '@hookform/resolvers/zod';
import {ErrorOption, FieldValues, Path, useForm} from 'react-hook-form';
import {z} from 'zod';
import {Button} from '@/components/ui/button';
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

interface Field {
  name: string;
  label: string;
  schema: z.ZodSchema;
  type?: string;
}

export function Form<
  TFields extends Field[],
  TSchema extends FieldValues = {
    [F in TFields[number] as F['name']]: F['schema'];
  },
>({
  fields,
  onSubmit,
  submitButtonText = 'Submit',
}: {
  fields: TFields;
  onSubmit: (data: TSchema) => Promise<ErrorOption | undefined>;
  submitButtonText?: string;
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
              render={({field}) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <Input {...field} type={type} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        <FormMessage>{form.formState.errors.root?.message}</FormMessage>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {submitButtonText}
        </Button>
      </form>
    </FormProvider>
  );
}
