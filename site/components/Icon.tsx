import type { SVGProps } from "react";

export type IconName = "alert" | "apps" | "arrow-left" | "arrow-right" | "bell" | "bot" | "cart" | "check" | "copy" | "coupon" | "dashboard" | "help" | "info" | "invoice" | "menu" | "package" | "payment" | "product" | "settings" | "shield" | "store" | "ticket" | "user";

export function Icon({ name, className = "h-5 w-5", ...props }: { name: IconName } & Omit<SVGProps<SVGSVGElement>, "name">) {
    const sizeClass = /(?:^|\s)(?:h-|w-|size-)/.test(className) ? "" : "h-5 w-5";
    const paths: Record<IconName, React.ReactNode> = {
        alert: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
        apps: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
        "arrow-left": <path d="m15 18-6-6 6-6"/>, "arrow-right": <path d="m9 18 6-6-6-6"/>,
        bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
        bot: <><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M9 12h.01M15 12h.01M9 16h6M12 7V4M9 4h6"/></>,
        cart: <><path d="M3 4h2l2 11h10l3-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></>,
        check: <path d="m5 12 4 4L19 6"/>,
        copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
        coupon: <><path d="M4 7a2 2 0 0 0 0 4v6h16v-6a2 2 0 0 0 0-4V5H4v2Z"/><path d="M12 7v2M12 13v2"/></>,
        dashboard: <><path d="M4 13a8 8 0 1 1 16 0"/><path d="m12 13 4-4M5 19h14"/></>,
        help: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01"/></>,
        info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
        invoice: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></>,
        menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
        package: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5M3 13l9 5 9-5"/></>,
        payment: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
        product: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></>,
        settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></>,
        shield: <><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4Z"/><path d="m9 12 2 2 4-4"/></>,
        store: <><path d="M4 10v10h16V10M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6"/></>,
        ticket: <><path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6Z"/><path d="M12 8v2M12 14v2"/></>,
        user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    };
    return <svg aria-hidden="true" viewBox="0 0 24 24" className={`${sizeClass} ${className} shrink-0 fill-none stroke-current stroke-[1.8]`} strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}
