-- Update the profiles SELECT policy to allow admins to view all profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile or admins can view all" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id 
  OR public.has_role(auth.uid(), 'ADMIN')
);