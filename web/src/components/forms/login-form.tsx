import {zodResolver} from '@hookform/resolvers/zod';
import {useForm} from 'react-hook-form';
import {z} from 'zod';
import {Button} from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {useState} from 'react';
import {useAuth} from '@/auth';
import {Link, useRouter} from '@tanstack/react-router';
import {Route} from '@/routes/login';
import {sleep} from '@/utils';

const formSchema = z.object({
  email: z.string().min(2, {
    message: 'Username must be at least 2 characters.',
  }),
  password: z.string().min(2, {
    message: 'Password must be at least 2 characters.',
  }),
});

export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });
  const {
    control,
    formState: {errors},
  } = form;

  const auth = useAuth();
  const router = useRouter();
  const search = Route.useSearch();

  const onSubmit = async ({email, password}: z.infer<typeof formSchema>) => {
    form.clearErrors();
    setIsSubmitting(true);

    const {status, message} = await auth.login(email, password);

    if (status === 'error') {
      setIsSubmitting(false);
      form.setError('root', {type: 'submit', message});

      return;
    }

    await sleep(1);
    await router.navigate({to: search.redirect || ''});

    setIsSubmitting(false);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-2">
          <FormField
            control={control}
            name="email"
            render={({field}) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="m@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="password"
            render={({field}) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input {...field} type="password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormMessage>{errors.root?.message}</FormMessage>
        </div>
        <div className="flex flex-col gap-2">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Login
          </Button>
          <Button variant="outline" className="w-full">
            Login with Google
          </Button>
        </div>
        <div className="text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="underline underline-offset-4">
            Sign up
          </Link>
        </div>
      </form>
    </Form>
  );
}
