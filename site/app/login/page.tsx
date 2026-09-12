import { LoginForm } from "@/components/LoginForm";
import TileBackground from "@/components/TileBackground";

export default function LoginPage() {
    return (
        <main className="login-page-root">
            <TileBackground />

            <div className="login-page-content">
                <LoginForm />
            </div>
        </main>
    );
}
