import { cn } from "@/lib/cn";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function Avatar({
  name,
  url,
  size = 40,
  className,
  ring,
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.34) };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        style={style}
        className={cn("shrink-0 rounded-full object-cover", ring && "ring-4 ring-amber-300", className)}
      />
    );
  }
  return (
    <div
      style={style}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-slate-200 font-semibold text-slate-700",
        ring && "ring-4 ring-amber-300",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
