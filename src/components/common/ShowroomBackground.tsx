import React from 'react';
import shoeStoreBg from '../../assets/images/shoe_store_blurred_bg_1790706924465.jpg';

interface ShowroomBackgroundProps {
  className?: string;
}

/**
 * ShowroomBackground
 * Aligned showroom background layer with 20% opacity (`opacity-20`) as `bg-cover`
 * across AuthModal, Loading Platform, InstallationWizard, TenantOnboardingWizard,
 * SuperAdmin Login, SuspendedStoreView, and UnknownStore404View routes.
 */
export const ShowroomBackground: React.FC<ShowroomBackgroundProps> = ({ className = '' }) => {
  return (
    <>
      {/* Showroom Background Image Layer (20% opacity / opacity-20 as cover) */}
      <div
        id="showroom-bg-image-layer"
        className={`fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 pointer-events-none transition-opacity duration-300 ${className}`}
        style={{
          backgroundImage: `url(${shoeStoreBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.2,
        }}
        aria-hidden="true"
      />

      {/* Subtle depth overlay ensuring crisp text contrast */}
      <div
        id="showroom-bg-depth-overlay"
        className="fixed inset-0 z-0 bg-slate-900/10 dark:bg-slate-950/20 pointer-events-none"
        aria-hidden="true"
      />
    </>
  );
};
