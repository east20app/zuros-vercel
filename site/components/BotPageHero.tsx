import type { ReactNode } from "react";

export function BotPageHero({
    eyebrow,
    title,
    description,
    meta,
    actions,
    className = "",
}: {
    eyebrow?: string;
    title: string;
    description?: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <section className={`bot-page-hero ${className}`}>
            <div className="bot-page-hero-copy">
                {eyebrow && (
                    <p className="home-kicker">
                        <span className="home-kicker-mark" />
                        {eyebrow}
                    </p>
                )}
                <h1>{title}</h1>
                {description && <p className="bot-page-hero-lede">{description}</p>}
            </div>
            {(meta || actions) && (
                <div className="bot-page-hero-side">
                    {meta}
                    {actions}
                </div>
            )}
        </section>
    );
}