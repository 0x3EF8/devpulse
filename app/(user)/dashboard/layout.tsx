import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import DashboardLayout from "@/app/components/dashboard/Navbar";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("wakatime_api_key, email, role")
    .eq("id", user.id)
    .single();

  if (!profile?.wakatime_api_key) {
    return <>{children}</>;
  }

  const email = profile?.email || user.email!;
  const name = user?.user_metadata?.name || email.split("@")[0];

  return (
    <DashboardLayout email={email} name={name} role={profile.role}>
      {children}
    </DashboardLayout>
  );
}
