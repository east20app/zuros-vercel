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
            className={`brand-logo ${compact ? "brand-logo-compact" : "brand-logo-full"} ${className}`}
        >
            <Image
                src="/zuros-mark.png"
                alt=""
                aria-hidden="true"
                width={1024}
                height={1024}
                priority={priority}
                sizes="40px"
                className="brand-logo-mark"
            />
            {!compact && (
                <span className="brand-logo-type">
                    <strong>ZUROS</strong>
                    <small>CENTRAL DE CONTROLE</small>
                </span>
            )}
        </span>
    );
}
