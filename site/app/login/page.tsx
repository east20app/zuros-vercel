import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="login-page-root min-h-dvh">
      <div className="login-page-background" aria-hidden="true">
        <div className="login-page-grid" />
        <div className="login-page-glow login-page-glow--one" />
        <div className="login-page-glow login-page-glow--two" />
      </div>

      <div className="login-page-content">
        <LoginForm />
      </div>
    </main>
  );
}
