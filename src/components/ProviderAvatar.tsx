import Image from "next/image";

/** The avatar of a repository owner on its host; nothing when the host gives none. */
export default function ProviderAvatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  if (!url) return null;
  return (
    <Image
      src={url}
      alt=""
      aria-hidden="true"
      title={name}
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded-md border border-gray-200 bg-white object-cover"
      style={{ width: size, height: size }}
    />
  );
}
