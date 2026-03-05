"use client";

import { useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { toast } from "react-toastify";
import HCaptcha from "@hcaptcha/react-hcaptcha";

export default function AuthPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const captcha = useRef<HCaptcha>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);

  const handleSignup = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowCaptcha(true);
  };

  const handleOAuthSignUp = async () => {
    await supabase.auth.signInWithOAuth({ provider: "github" });
  };

  const handleCaptchaVerify = async (token: string) => {
    setShowCaptcha(false);
    setLoading(true);

    const signUp = new Promise(async (resolve, reject) => {
      try {
        if (password !== confirmPassword) {
          return reject(new Error("Passwords do not match!"));
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { captchaToken: token },
        });

        if (error) return reject(error);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });

    toast.promise(signUp, {
      pending: "Signing up...",
      success: {
        render() {
          if (captcha.current) captcha.current.resetCaptcha();
          setLoading(false);
          setEmail("");
          setPassword("");
          setConfirmPassword("");
          return "Signed up successfully! Check your email to confirm your account.";
        },
      },
      error: {
        render({ data }) {
          if (captcha.current) captcha.current.resetCaptcha();
          setLoading(false);
          const err = data as Error;
          return err?.message || "Failed to signup. Please try again.";
        },
      },
    });
  };

  return (
    <>
      <form onSubmit={handleSignup}>
        <input
          type="email"
          placeholder="Email"
          className="w-full p-3 rounded-xl bg-black/40 border border-gray-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 rounded-xl bg-black/40 border border-gray-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Confirm Password"
          className="w-full p-3 rounded-xl bg-black/40 border border-gray-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition mb-4"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          Sign Up
        </button>

        <button
          type="button"
          onClick={handleOAuthSignUp}
          className="w-full py-3 rounded-lg font-semibold transition
                     bg-gray-700 hover:bg-gray-600 text-white"
        >
          Sign Up with GitHub
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
