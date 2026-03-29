"use client";

import { useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";

export default function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const redirectTo =
    redirectParam &&
    redirectParam.startsWith("/") &&
    !redirectParam.startsWith("//")
      ? redirectParam
      : "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const captcha = useRef<HCaptcha>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);

  const handleLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowCaptcha(true);
  };

  const handleOAuthSignIn = async (provider: "google" | "azure" | "github") => {
    document.cookie = `devpulse_redirect=${encodeURIComponent(redirectTo)}; path=/; max-age=600; samesite=lax`;
    await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${location.origin}/api/auth/callback`,
      },
    });
  };

  const handleCaptchaVerify = async (token: string) => {
    setShowCaptcha(false);
    setLoading(true);

    const signInWithPassword = new Promise(async (resolve, reject) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
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
      router.push(redirectTo);
    });
  };

  const handleGoogleSignIn = () => handleOAuthSignIn("google");
  const handleMicrosoftSignIn = () => handleOAuthSignIn("azure");
  const handleGitHubSignIn = () => handleOAuthSignIn("github");

  return (
    <>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="input-field"
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="input-field"
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
            loading
              ? "bg-gray-800 cursor-not-allowed opacity-60"
              : "btn-primary"
          }`}
        >
          Login
        </button>

        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-gray-500">Or continue with</span>
        </div>

        <div className="flex flex-row-321 gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center w-full py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 transition-colors shadow-sm"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 48 48">
              <g>
                <path
                  fill="#4285F4"
                  d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.87-6.87C36.13 2.36 30.45 0 24 0 14.82 0 6.73 5.82 2.69 14.29l7.98 6.2C12.47 13.98 17.77 9.5 24 9.5z"
                />
                <path
                  fill="#34A853"
                  d="M46.14 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.44c-.54 2.9-2.17 5.36-4.62 7.01l7.19 5.59C43.97 37.45 46.14 31.54 46.14 24.55z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.67 28.49a14.5 14.5 0 0 1 0-9.01l-7.98-6.2A24.01 24.01 0 0 0 0 24c0 3.77.9 7.34 2.69 10.51l7.98-6.02z"
                />
                <path
                  fill="#EA4335"
                  d="M24 48c6.45 0 12.13-2.13 16.19-5.8l-7.19-5.59c-2.01 1.35-4.59 2.15-9 2.15-6.23 0-11.53-4.48-13.33-10.49l-7.98 6.02C6.73 42.18 14.82 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </g>
            </svg>
            <span className="font-medium text-gray-700">Google</span>
          </button>

          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            className="flex items-center justify-center w-full py-3 rounded-lg bg-[#f3f3f3] border border-gray-300 hover:bg-gray-200 transition-colors shadow-sm"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <rect fill="#F35325" x="1" y="1" width="10" height="10" />
              <rect fill="#81BC06" x="13" y="1" width="10" height="10" />
              <rect fill="#05A6F0" x="1" y="13" width="10" height="10" />
              <rect fill="#FFBA08" x="13" y="13" width="10" height="10" />
            </svg>
            <span className="font-medium text-gray-700">Microsoft</span>
          </button>

          <button
            type="button"
            onClick={handleGitHubSignIn}
            className="flex items-center justify-center w-full py-3 rounded-lg bg-[#f3f3f3] border border-gray-300 hover:bg-gray-200 transition-colors shadow-sm"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path d="m12.301 0h.093c2.242 0 4.34.613 6.137 1.68l-.055-.031c1.871 1.094 3.386 2.609 4.449 4.422l.031.058c1.04 1.769 1.654 3.896 1.654 6.166 0 5.406-3.483 10-8.327 11.658l-.087.026c-.063.02-.135.031-.209.031-.162 0-.312-.054-.433-.144l.002.001c-.128-.115-.208-.281-.208-.466 0-.005 0-.01 0-.014v.001q0-.048.008-1.226t.008-2.154c.007-.075.011-.161.011-.249 0-.792-.323-1.508-.844-2.025.618-.061 1.176-.163 1.718-.305l-.076.017c.573-.16 1.073-.373 1.537-.642l-.031.017c.508-.28.938-.636 1.292-1.058l.006-.007c.372-.476.663-1.036.84-1.645l.009-.035c.209-.683.329-1.468.329-2.281 0-.045 0-.091-.001-.136v.007c0-.022.001-.047.001-.072 0-1.248-.482-2.383-1.269-3.23l.003.003c.168-.44.265-.948.265-1.479 0-.649-.145-1.263-.404-1.814l.011.026c-.115-.022-.246-.035-.381-.035-.334 0-.649.078-.929.216l.012-.005c-.568.21-1.054.448-1.512.726l.038-.022-.609.384c-.922-.264-1.981-.416-3.075-.416s-2.153.152-3.157.436l.081-.02q-.256-.176-.681-.433c-.373-.214-.814-.421-1.272-.595l-.066-.022c-.293-.154-.64-.244-1.009-.244-.124 0-.246.01-.364.03l.013-.002c-.248.524-.393 1.139-.393 1.788 0 .531.097 1.04.275 1.509l-.01-.029c-.785.844-1.266 1.979-1.266 3.227 0 .025 0 .051.001.076v-.004c-.001.039-.001.084-.001.13 0 .809.12 1.591.344 2.327l-.015-.057c.189.643.476 1.202.85 1.693l-.009-.013c.354.435.782.793 1.267 1.062l.022.011c.432.252.933.465 1.46.614l.046.011c.466.125 1.024.227 1.595.284l.046.004c-.431.428-.718 1-.784 1.638l-.001.012c-.207.101-.448.183-.699.236l-.021.004c-.256.051-.549.08-.85.08-.022 0-.044 0-.066 0h.003c-.394-.008-.756-.136-1.055-.348l.006.004c-.371-.259-.671-.595-.881-.986l-.007-.015c-.198-.336-.459-.614-.768-.827l-.009-.006c-.225-.169-.49-.301-.776-.38l-.016-.004-.32-.048c-.023-.002-.05-.003-.077-.003-.14 0-.273.028-.394.077l.007-.003q-.128.072-.08.184c.039.086.087.16.145.225l-.001-.001c.061.072.13.135.205.19l.003.002.112.08c.283.148.516.354.693.603l.004.006c.191.237.359.505.494.792l.01.024.16.368c.135.402.38.738.7.981l.005.004c.3.234.662.402 1.057.478l.016.002c.33.064.714.104 1.106.112h.007c.045.002.097.002.15.002.261 0 .517-.021.767-.062l-.027.004.368-.064q0 .609.008 1.418t.008.873v.014c0 .185-.08.351-.208.466h-.001c-.119.089-.268.143-.431.143-.075 0-.147-.011-.214-.032l.005.001c-4.929-1.689-8.409-6.283-8.409-11.69 0-2.268.612-4.393 1.681-6.219l-.032.058c1.094-1.871 2.609-3.386 4.422-4.449l.058-.031c1.739-1.034 3.835-1.645 6.073-1.645h.098-.005zm-7.64 17.666q.048-.112-.112-.192-.16-.048-.208.032-.048.112.112.192.144.096.208-.032zm.497.545q.112-.08-.032-.256-.16-.144-.256-.048-.112.08.032.256.159.157.256.047zm.48.72q.144-.112 0-.304-.128-.208-.272-.096-.144.08 0 .288t.272.112zm.672.673q.128-.128-.064-.304-.192-.192-.32-.048-.144.128.064.304.192.192.32.044zm.913.4q.048-.176-.208-.256-.24-.064-.304.112t.208.24q.24.097.304-.096zm1.009.08q0-.208-.272-.176-.256 0-.256.176 0 .208.272.176.256.001.256-.175zm.929-.16q-.032-.176-.288-.144-.256.048-.224.24t.288.128.225-.224z" />
            </svg>
            <span className="font-medium text-gray-700"> GitHub</span>
          </button>
        </div>
      </form>

      {showCaptcha && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
          <div className="glass-card p-8 text-center">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">
              Verify you are human
            </h3>

            <HCaptcha
              ref={captcha}
              sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || ""}
              onVerify={handleCaptchaVerify}
            />

            <button
              onClick={() => setShowCaptcha(false)}
              className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
