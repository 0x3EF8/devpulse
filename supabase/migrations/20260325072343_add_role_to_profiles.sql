ALTER TABLE public.profiles
ADD COLUMN role text NOT NULL DEFAULT 'user';

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('user', 'admin'));
