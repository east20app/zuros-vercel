import Image from "next/image";

type BrandLogoProps = {
    className?: string;
    priority?: boolean;
    compact?: boolean;
};

export function BrandLogo({ className = "", priority = false, compact = false }: BrandLogoProps) {
    return (
        <span
            role="img"
            aria-label="ZUROS"
            className={`relative block shrink-0 overflow-hidden ${className}`}
        >
            <Image
                src="/brand-logo-transparent.png"
                alt=""
                aria-hidden="true"
                width={2172}
                height={724}
                priority={priority}
                sizes={compact ? "40px" : "(max-width: 640px) 112px, 160px"}
                className={compact
                    ? "pointer-events-none absolute left-0 top-0 h-full w-auto max-w-none select-none"
                    : "pointer-events-none h-full w-full object-contain select-none"}
            />
        </span>
    );
}