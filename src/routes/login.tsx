import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/api/authApi";
import { useAuthStore } from "@/store/auth";
import logo from "@/assets/logo.svg";

function extractTokenAndUser(res: any) {
  let token: string | null = null;
  let user: any = null;

  if (typeof res === "string" && res.length > 20) {
    token = res;
  } else if (res && typeof res === "object") {
    token =
      res.token ||
      res.accessToken ||
      res.access_token ||
      res.jwt ||
      res.data?.token ||
      res.data?.accessToken ||
      res.data?.access_token ||
      (typeof res.data === "string" && res.data.length > 20 ? res.data : null);

    user = res.user || res.data?.user || (res.id && res.email ? res : null);
  }

  return { token, user };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "true";
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && token) navigate("/dashboard", { replace: true });
  }, [hydrated, token, navigate]);

  useEffect(() => {
    if (expired) toast.info("Your session expired. Please sign in again.");
  }, [expired]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.loginClinic({ email: email.trim(), password });
      const { token: tok, user: usr } = extractTokenAndUser(res);

      if (!tok) {
        console.error("Login response payload missing token:", res);
        throw new Error("No token returned from server");
      }

      setSession(tok, usr ?? null, remember);
      toast.success("Welcome back to your Clinic Portal");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 bg-background text-foreground">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-secondary-500/25 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass w-full max-w-md rounded-3xl p-8 shadow-xl"
      >
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="Iyadati Clinic" className="h-12 w-12 object-contain" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Clinic Portal</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Manage facility, affiliated doctors & schedule
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">Email address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="clinic@example.com"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <div className="relative">
              <input
                id="password"
                type={show ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="glass w-full rounded-xl px-3.5 py-2.5 pe-10 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-accent cursor-pointer"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary-500 focus:ring-primary-500/40"
            />
            Keep me signed in
          </label>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in to Clinic Portal
          </button>
        </form>
      </motion.div>
    </div>
  );
}
