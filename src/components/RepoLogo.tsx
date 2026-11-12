import Image from "next/image";

interface RepoLogoProps {
  logoUrl: string | null;
  /** Name of the software, used for the alt text */
  name: string;
  size: number;
}

/** Logo declared in publiccode.yml; served unoptimized from the git host, so any host is allowed. */
export default function RepoLogo({ logoUrl, name, size }: RepoLogoProps) {
  if (!logoUrl) return null;

  return (
    <Image
      src={logoUrl}
      alt={`${name} logo`}
      width={size}
      height={size}
      unoptimized
      className="object-contain shrink-0 rounded"
      style={{ width: size, height: size }}
    />
  );
}
