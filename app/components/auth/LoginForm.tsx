"use client";

import { useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";

export default function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const captcha = useRef<HCaptcha>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);

  const handleLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowCaptcha(true);
  };

  const handleOAuthSignIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: "github" });
  };

  const handleCaptchaVerify = async (token: string) => {
    setShowCaptcha(false);
    setLoading(true);

    const signInWithPassword = new Promise(async (resolve, reject) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken: token},
        });

        if (error) return reject(error);

        resolve(data);
      } catch (error) {
        reject(error);
      }
    });

    toast.promise(signInWithPassword, {
      pending: "Logging in...",
      success: "Login successful! Redirecting...",
      error: {
        render({ data }) {
          if (captcha.current) captcha.current.resetCaptcha();
          setLoading(false);
          const err = data as Error;
          return err?.message || "Failed to login. Please try again.";
        },
      },
    });

    signInWithPassword.then(() => {
      if (captcha.current) captcha.current.resetCaptcha();
      router.push("/dashboard");
    });
  };

  return (
    <>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          className="w-full p-3 rounded-xl bg-black/40 border border-gray-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition mb-4"
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 rounded-xl bg-black/40 border border-gray-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition mb-4"
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 mb-3 rounded-lg font-semibold transition
         ${
           loading
             ? "bg-gray-700 cursor-not-allowed opacity-70"
             : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:scale-105"
         }`}
        >
          Login
        </button>

        <button
          type="button"
          onClick={handleOAuthSignIn}
          className="w-full py-3 rounded-lg font-semibold transition
                     bg-gray-700 hover:bg-gray-600 text-white"
        >
          Sign In with GitHub
        </button>
      </form>

      {showCaptcha && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-gray-900 p-6 rounded-xl shadow-xl text-center">
            <h2 className="text-lg font-semibold mb-4">Verify you are human</h2>

            <HCaptcha
              ref={captcha}
              sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || ""}
              onVerify={handleCaptchaVerify}
            />

            <button
              onClick={() => setShowCaptcha(false)}
              className="mt-4 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
