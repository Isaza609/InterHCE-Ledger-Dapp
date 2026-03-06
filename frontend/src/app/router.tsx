import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { EpisodiosPage } from "../pages/EpisodiosPage";
import { CrearEpisodioPage } from "../pages/CrearEpisodioPage";
import { VerEpisodioPage } from "../pages/VerEpisodioPage";

export function AppRouter() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/episodios" element={<EpisodiosPage />} />
        <Route path="/episodios/crear" element={<CrearEpisodioPage />} />
        <Route path="/episodios/ver/:id" element={<VerEpisodioPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

