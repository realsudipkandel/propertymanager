import Image from "next/image";

const LOGO_WIDTH = 687;
const LOGO_HEIGHT = 612;

export function BrandLogo({ className, priority = false }: { className: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/mira-logo.png"
      alt="Mira Properties Ltd"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={className}
    />
  );
}
