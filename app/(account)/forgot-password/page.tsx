import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/supabase";
export default function Page() {
  return <AuthForm mode="forgot-password" available={configured()} />;
}
