/**
 * INTERN INTEGRATION: Invite Dialog
 * 
 * Modal form for supervisors to create new intern accounts.
 * Shows credentials after successful creation.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Copy, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateInternAccount, type InternCredentials } from '@/hooks/useInternSupervision';
import { toast } from 'sonner';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  institution: z.string().optional(),
  durationDays: z.string().min(1, 'Please select access duration'),
});

type FormValues = z.infer<typeof formSchema>;

interface InternInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InternInviteDialog({ open, onOpenChange }: InternInviteDialogProps) {
  const [credentials, setCredentials] = useState<InternCredentials | null>(null);
  const [copied, setCopied] = useState(false);
  const createIntern = useCreateInternAccount();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      name: '',
      institution: '',
      durationDays: '30',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await createIntern.mutateAsync({
        email: values.email,
        name: values.name,
        institution: values.institution || undefined,
        durationDays: parseInt(values.durationDays, 10),
      });
      
      setCredentials(result);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleCopyCredentials = () => {
    if (!credentials) return;
    
    const text = `Legal App Intern Access\n\nEmail: ${credentials.email}\nTemporary Password: ${credentials.tempPassword}\nExpires: ${new Date(credentials.expiresAt).toLocaleDateString()}\n\nPlease log in and change your password immediately.`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard');
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setCredentials(null);
    setCopied(false);
    form.reset();
    onOpenChange(false);
  };

  // If we have credentials, show the handoff screen
  if (credentials) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Check className="h-5 w-5" />
              Intern Account Created
            </DialogTitle>
            <DialogDescription>
              Share these credentials with {credentials.name}. The password is shown only once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="border-primary/20 bg-primary/5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Save these credentials now. The password cannot be retrieved later.
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3 font-mono text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span>{' '}
                <span className="font-medium">{credentials.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Password:</span>{' '}
                <span className="font-medium text-primary">{credentials.tempPassword}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Expires:</span>{' '}
                <span className="font-medium">
                  {new Date(credentials.expiresAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopyCredentials}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Credentials
                  </>
                )}
              </Button>
              <Button onClick={handleClose} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show the invite form
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Intern
          </DialogTitle>
          <DialogDescription>
            Create a supervised intern account. They'll receive limited, time-bound access.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="intern@lawschool.edu"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Priya Sharma" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="institution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="NLU Jodhpur" {...field} />
                  </FormControl>
                  <FormDescription>
                    Law school or institution name
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="durationDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Duration</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="7">1 Week</SelectItem>
                      <SelectItem value="14">2 Weeks</SelectItem>
                      <SelectItem value="30">1 Month</SelectItem>
                      <SelectItem value="60">2 Months</SelectItem>
                      <SelectItem value="90">3 Months</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Account will auto-expire after this period
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createIntern.isPending}
                className="flex-1"
              >
                {createIntern.isPending ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
