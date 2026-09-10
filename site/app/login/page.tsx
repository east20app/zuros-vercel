import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
    return (
        <main className="login-page-root">
            <div
                className="login-page-background"
                aria-hidden="true"
            >
                <div className="login-page-aurora" />
                <div className="login-page-grid" />
                <div className="login-page-glow login-page-glow--one" />
                <div className="login-page-glow login-page-glow--two" />
                <div className="login-page-glow login-page-glow--three" />
                <div className="login-page-particles" />
                <div className="login-page-vignette" />
            </div>

            <div className="login-page-content">
                <LoginForm />
            </div>
        </main>
    );
}
