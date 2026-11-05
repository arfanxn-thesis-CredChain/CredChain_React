import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import * as identicon from "@dicebear/identicon";
import { UserCircle } from "lucide-react";
import { cn } from "@shared/lib/cn";

const CACHE = new Map<string, string>();
const MAX_CACHE = 256;

interface UserAvatarProps {
  user: {
    id?: string;
    wallet_address?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = { sm: 24, md: 40, lg: 56, xl: 96 } as const;

function generateAvatar(seed: string, sizePx: number): string {
  const cacheKey = `${seed}:${sizePx}`;
  const hit = CACHE.get(cacheKey);
  if (hit) return hit;

  const svg = createAvatar(identicon, {
    seed,
    backgroundColor: ["transparent"],
    size: sizePx,
  }).toString();
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  if (CACHE.size >= MAX_CACHE) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }
  CACHE.set(cacheKey, dataUri);
  return dataUri;
}

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const sizePx = SIZE_MAP[size];
  const seed = user?.wallet_address || user?.id || user?.email || "anonymous";

  const avatarUrl = useMemo(() => {
    if (!user) return null;
    return generateAvatar(seed, sizePx);
  }, [user, seed, sizePx]);

  if (!user || !avatarUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-gray-100 text-gray-400",
          className,
        )}
        style={{ width: sizePx, height: sizePx }}
        aria-hidden="true"
      >
        <UserCircle style={{ width: sizePx * 0.6, height: sizePx * 0.6 }} />
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt=""
      role="presentation"
      className={cn("rounded-full bg-gray-50", className)}
      style={{ width: sizePx, height: sizePx }}
      title={user.name ?? user.email ?? "User"}
    />
  );
}
