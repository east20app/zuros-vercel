const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#09090b"/><path d="M15 15h36v8L28 43h23v8H13v-8l23-20H15z" fill="#34d399"/><path d="M15 15h36" stroke="#a7f3d0" stroke-width="3"/></svg>`;

export function GET() {
    return new Response(favicon, {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
        },
    });
}
