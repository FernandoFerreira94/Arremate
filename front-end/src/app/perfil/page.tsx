import type { Metadata } from "next";
import { ProfilePage } from "@/features/info/profile-page";

export const metadata: Metadata = { title: "Perfil", description: "Dados da conta de demonstração.", robots: { index: false, follow: false } };

export default function PerfilPage() {
  return <ProfilePage />;
}
