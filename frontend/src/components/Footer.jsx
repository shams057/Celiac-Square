import React from 'react';
import { ShieldCheck, Heart, ExternalLink, BookOpen, MapPin, Mail } from 'lucide-react';

export default function Footer({ lang }) {
  return (
    <footer className="bg-[#FAF8F2] border-t border-canvas-border mt-16 text-secondary-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-xl font-extrabold tracking-tight">
                Celiac<span className="text-accent">Square</span> <span className="text-sm font-semibold text-primary">Tunisie</span>
              </span>
            </div>

            <p className="text-xs text-secondary leading-relaxed max-w-md">
              Plateforme numérique d'assistance quotidienne pour les personnes atteintes de maladie cœliaque et intolérantes au gluten en Tunisie. Intègre la vérification visuelle par intelligence artificielle, le Guide de l'Association Tunisienne de la Cœliaque (ATC) et la base Open Food Facts.
            </p>

            <div className="flex items-center gap-3 text-xs text-secondary/70">
              <span>Palette Thématique :</span>
              <span className="w-4 h-4 rounded-full bg-primary" title="#8BA850 Sage Olive Green"></span>
              <span className="w-4 h-4 rounded-full bg-secondary" title="#756452 Earthy Brown"></span>
              <span className="w-4 h-4 rounded-full bg-accent" title="#FF8A41 Vibrant Orange"></span>
              <span className="w-4 h-4 rounded-full bg-canvas border border-canvas-border" title="#DBD5BF Soft Sand"></span>
            </div>
          </div>

          {/* Useful Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-secondary-dark">
              Ressources & Guides
            </h4>
            <ul className="space-y-2 text-xs text-secondary">
              <li>
                <a
                  href="https://world.openfoodfacts.org"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Base Open Food Facts
                </a>
              </li>
              <li>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-accent" /> Guide Alimentaire ATC 2026
                </span>
              </li>
              <li>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" /> Répertoire National des Spécialistes
                </span>
              </li>
            </ul>
          </div>

          {/* Medical Notice */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-secondary-dark">
              Avertissement Médical
            </h4>
            <p className="text-[11px] text-secondary/80 leading-relaxed bg-canvas/40 p-3 rounded-xl border border-canvas-border/50">
              Les informations présentées sur Celiac Square sont fournies à titre indicatif et éducatif. Consultez toujours un gastro-entérologue ou un professionnel de santé qualifié pour tout diagnostic médical.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-canvas-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-secondary/70">
          <p>© 2026 Celiac Square Tunisie. Dédié à la communauté cœliaque tunisienne.</p>
          <div className="flex items-center gap-1">
            <span>Conçu avec</span>
            <Heart className="w-3.5 h-3.5 text-accent fill-accent" />
            <span>pour une alimentation sécurisée en Tunisie</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
