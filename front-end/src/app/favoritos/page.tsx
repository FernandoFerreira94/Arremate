import type { Metadata } from "next";
import { FavoritesPage } from "@/features/favorites/favorites-page";

export const metadata: Metadata = { title: "Meus favoritos", description: "Lotes que você acompanha.", robots: { index: false, follow: false } };

export default function FavoritosPage() {
  return <FavoritesPage />;
}
